
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, MapPin, MessageSquare, Send, User, Loader2 } from 'lucide-react';
import { Cafe, AmenityKey, Review } from '../../types';
import { COLORS, AMENITY_CONFIG, getScoreColor, AMENITY_KEYS } from '../../constants';
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { CreateReviewRequest, CreateReviewResponse } from '../../types';
import { submitReviewTransaction, ReviewTransactionData } from '../../lib/sui-transaction';
import { getCafeImageUrl } from '../../lib/cafe-images';
import { PointsEarnedModal } from './PointsEarnedModal';
import { usePoints } from '../../contexts/PointsContext';
import { getCurrentLocation, isWithinVerificationDistance, calculateDistance } from '../../lib/geolocation';

interface SidebarProps {
  cafe: Cafe | null;
  onClose: () => void;
  onReviewPosted?: () => void; // Callback when review is successfully posted
}

export const Sidebar: React.FC<SidebarProps> = ({ cafe, onClose, onReviewPosted }) => {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const walletAddress = currentAccount?.address || null;
  const isWalletConnected = !!currentAccount;
  const { addPoints, refreshPoints, balance } = usePoints(); // Global points state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isWriting, setIsWriting] = useState(false);
  const [newReviewText, setNewReviewText] = useState("");
  const [ratings, setRatings] = useState<Record<AmenityKey, number>>({
    wifi: 5,
    outlet: 5,
    comfort: 5,
    hygiene: 5,
    quality: 5,
    noise: 5,
    service: 5,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptImage, setReceiptImage] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showPointsEarned, setShowPointsEarned] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [newTotalPoints, setNewTotalPoints] = useState(0);

  // Check if current user already added this place
  const hasUserAddedThisPlace = cafe?.walletAddress && walletAddress && 
    cafe.walletAddress.toLowerCase() === walletAddress.toLowerCase();

  useEffect(() => {
    if (cafe) {
      setReviews(cafe.reviews || []);
      setIsWriting(false);
      setNewReviewText("");
      setReceiptImage(null);
      setReceiptPreview(null);
      // Reset ratings to cafe's current averages
      setRatings(cafe.amenities);
    }
  }, [cafe]);

  const handleReceiptImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptImage(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePostReview = async () => {
    if (!newReviewText.trim()) return;

    // Step 1: Check wallet connection
    if (!isWalletConnected || !walletAddress) {
      alert('Lütfen önce cüzdanınızı bağlayın!');
      return;
    }

    if (!cafe) return;

    setIsSubmitting(true);

    try {
      // Check daily review limit BEFORE submitting
      try {
        const limitCheckResponse = await fetch('/api/reviews/check-daily-limit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress }),
        });

        if (limitCheckResponse.ok) {
          const limitData = await limitCheckResponse.json();
          if (!limitData.canReview) {
            alert(`Günlük değerlendirme limitine ulaştınız! Günde maksimum ${limitData.maxReviews} değerlendirme yapabilirsiniz.`);
            setIsSubmitting(false);
            return;
          }
        }
      } catch (limitError) {
        console.warn('Daily limit check failed, continuing anyway:', limitError);
        // Continue even if limit check fails
      }
      // Calculate average rating from amenity ratings (convert 0-10 to 1-5 scale)
      const ratingValues = Object.values(ratings) as number[];
      const avgRating = ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length;
      const rating1to5 = Math.round((avgRating / 10) * 5); // Convert to 1-5 scale

      // Step 1.5: Get current user points to include in on-chain transaction
      let currentTotalPoints = 0;
      try {
        const pointsResponse = await fetch(`/api/user/points?walletAddress=${walletAddress}`);
        if (pointsResponse.ok) {
          const pointsData = await pointsResponse.json();
          currentTotalPoints = pointsData.totalPoints || 0;
          console.log(`Current total points: ${currentTotalPoints} (will be stored on-chain)`);
        } else {
          console.warn('Failed to fetch current points, using 0');
        }
      } catch (pointsError) {
        console.warn('Error fetching current points, using 0:', pointsError);
      }

      // Step 2: Prepare review data for Sui transaction (includes current total points)
      const reviewData: ReviewTransactionData = {
        placeId: cafe.id,
        placeName: cafe.name,
        walletAddress: walletAddress,
        rating: Math.max(1, Math.min(5, rating1to5)), // Ensure 1-5 range
        comment: newReviewText,
        coordinates: [cafe.coordinates[0], cafe.coordinates[1]], // [lat, lng]
        address: cafe.address,
        timestamp: Date.now(),
        totalPoints: currentTotalPoints, // Mevcut toplam puan (blockchain'e kaydedilecek)
      };

      // Step 3: Sign Sui transaction FIRST (user must sign before submitting to backend)
      // This will open the wallet popup for user to sign
      console.log('Requesting user signature for Sui transaction...');
      const transactionDigest = await submitReviewTransaction(
        reviewData,
        signAndExecute
      );

      console.log('Sui transaction signed successfully:', transactionDigest);

      // Step 4: Get user's GPS location for verification (ZORUNLU - 2 deneme hakkı)
      console.log('Requesting GPS location for verification...');
      setIsRequestingLocation(true);
      setLocationError(null);
      
      // İlk deneme
      let location = await getCurrentLocation(1); // 1 retry = 2 toplam deneme
      
      // Eğer ilk 2 denemede alınamazsa, kullanıcıya tekrar deneme şansı ver
      if (!location) {
        setIsRequestingLocation(false);
        const retry = confirm(
          'Konum bilgisi alınamadı. Değerlendirme yapabilmek için konum izni gerekiyor.\n\n' +
          'Tekrar denemek ister misiniz? (Tarayıcı izin penceresi tekrar açılacak)'
        );
        
        if (retry) {
          setIsRequestingLocation(true);
          location = await getCurrentLocation(1); // Tekrar 2 deneme
        }
      }
      
      setIsRequestingLocation(false);
      
      // GPS konumu ZORUNLU - alınamazsa review gönderilemez
      if (!location) {
        alert('Konum bilgisi alınamadı! Değerlendirme yapabilmek için konum izni vermeniz gerekiyor. Lütfen tarayıcı ayarlarından konum iznini açın ve tekrar deneyin.');
        setIsSubmitting(false);
        return;
      }
      
      setUserLocation(location);
      
      // Mekanın 150 metre içinde olup olmadığını kontrol et
      const distance = calculateDistance(
        location.lat,
        location.lng,
        cafe.coordinates[0],
        cafe.coordinates[1]
      );
      
      const isWithinRange = distance <= 150;
      
      if (!isWithinRange) {
        alert(
          `❌ Değerlendirme reddedildi!\n\n` +
          `Mekanın ${Math.round(distance)} metre uzağındasınız.\n` +
          `Değerlendirme yapabilmek için mekanın 150 metre içinde olmanız gerekiyor.\n\n` +
          `Lütfen mekana yaklaşıp tekrar deneyin.`
        );
        setIsSubmitting(false);
        return;
      }
      
      console.log(`✅ GPS verification passed: ${Math.round(distance)}m from place`);

      // Step 5: Check receipt image (required)
      if (!receiptImage) {
        alert('Lütfen fiş fotoğrafı yükleyin!');
        setIsSubmitting(false);
        return;
      }

      // Step 5: After successful signature, send to backend (which will upload to Walrus)
      // Use FormData for multipart/form-data
      const formData = new FormData();
      formData.append('placeId', cafe.id);
      formData.append('placeName', cafe.name);
      formData.append('lat', String(cafe.coordinates[0]));
      formData.append('lng', String(cafe.coordinates[1]));
      formData.append('rating', String(rating1to5));
      formData.append('comment', newReviewText);
      formData.append('walletAddress', walletAddress);
      formData.append('transactionDigest', transactionDigest);
      formData.append('receiptImage', receiptImage); // Required file

      const response = await fetch('/api/reviews', {
        method: 'POST',
        body: formData, // FormData automatically sets Content-Type with boundary
      });

      if (!response.ok) {
        let errorMessage = 'Failed to submit review to backend';
        let errorDetails = '';
        let errorType = 'UnknownError';
        
        try {
          const errorData = await response.json();
          errorType = errorData.error || errorType;
          errorMessage = errorData.message || errorData.error || errorMessage;
          errorDetails = errorData.details || errorData.missingFields?.join(', ') || '';
          
          console.error('Backend error response:', {
            status: response.status,
            errorType,
            errorMessage,
            errorDetails,
            fullError: errorData
          });
        } catch (e) {
          try {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
            console.error('Backend error (text):', {
              status: response.status,
              errorText
            });
          } catch (textError) {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            console.error('Backend error (no body):', {
              status: response.status,
              statusText: response.statusText
            });
          }
        }
        
        const fullError = new Error(errorMessage);
        (fullError as any).type = errorType;
        (fullError as any).status = response.status;
        (fullError as any).details = errorDetails;
        throw fullError;
      }

      const result: CreateReviewResponse = await response.json();
      const { walrusId } = result;

      // Step 6: Award points on-chain (separate transaction)
      // This happens AFTER Walrus upload so we can include the blob ID
      console.log('Awarding points on-chain for successful review...');
      const POINTS_EARNED = 100; // Fixed amount per review
      
      // Update global points state IMMEDIATELY (optimistic update)
      // This ensures Profile and Shop modals show the new balance right away
      addPoints(POINTS_EARNED);
      console.log('[Sidebar] Added 100 points to global balance (optimistic update)');
      
      try {
        const { awardPointsTransaction } = await import('../../lib/sui-points-transaction');
        const pointsTxDigest = await awardPointsTransaction(POINTS_EARNED, walrusId, signAndExecute);
        console.log('Points awarded successfully:', pointsTxDigest);
      } catch (pointsError) {
        console.error('Failed to award points on-chain:', pointsError);
        // Points already added optimistically, so user still sees the update
      }

      // Get updated points from response (if available)
      const earnedPoints = result.pointsEarned || POINTS_EARNED; // Default to 100 if not in response
      
      // Get final balance from global state (after optimistic update)
      // Will be refreshed from on-chain after delay
      let updatedTotalPoints = balance + POINTS_EARNED;

      // Create local review for immediate UI update
    const newReview: Review = {
        id: result.review.id,
        userName: walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4),
        rating: rating1to5,
      text: newReviewText,
      date: "Just now"
    };

    setReviews([newReview, ...reviews]);
    setNewReviewText("");
    setIsWriting(false);
      setIsSubmitting(false);

      // Show points earned modal
      setPointsEarned(earnedPoints);
      setNewTotalPoints(updatedTotalPoints);
      setShowPointsEarned(true);

      // Trigger points refresh in modals IMMEDIATELY (on-chain points are already updated)
      // This ensures Profile and Shop show the new balance right away
      if (onReviewPosted) {
        // Call immediately for on-chain points, and again after a delay for backend sync
        onReviewPosted();
        setTimeout(() => {
          onReviewPosted(); // Refresh again after backend processes
        }, 2000);
      }

      // Refresh map to show new place
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      console.error('Failed to post review:', error);
      console.error('Error type:', error.type);
      console.error('Error status:', error.status);
      console.error('Error details:', error.details);
      console.error('Full error object:', error);
      
      // Check if it's a user rejection (wallet popup cancelled)
      if (error.message?.includes('User rejected') || error.message?.includes('rejected')) {
        alert('İşlem iptal edildi. Cüzdan imzası gerekli.');
        setIsSubmitting(false);
        return;
      }
      
      // Build user-friendly error message
      let userMessage = 'Yorum gönderilemedi';
      
      if (error.type === 'ValidationError') {
        userMessage = `Doğrulama hatası: ${error.message || 'Eksik veya hatalı bilgi'}`;
        if (error.details) {
          userMessage += `\n\nDetaylar: ${error.details}`;
        }
      } else if (error.type === 'WalrusUploadFailed') {
        userMessage = `Walrus'a yükleme başarısız: ${error.message || 'Bilinmeyen hata'}`;
        if (error.details) {
          userMessage += `\n\nTeknik detay: ${error.details}`;
        }
      } else if (error.status === 400) {
        userMessage = `Geçersiz istek: ${error.message || 'Lütfen tüm alanları doldurun'}`;
      } else if (error.status === 502) {
        userMessage = `Harici servis hatası: ${error.message || 'Walrus servisi yanıt vermiyor'}`;
      } else if (error.status === 500) {
        userMessage = `Sunucu hatası: ${error.message || 'Lütfen daha sonra tekrar deneyin'}`;
      } else {
        userMessage = `${error.message || 'Bilinmeyen hata'}`;
        if (error.details && process.env.NODE_ENV === 'development') {
          userMessage += `\n\n[Debug] ${error.details}`;
        }
      }
      
      alert(userMessage);
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {cafe && (
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed top-0 right-0 h-full w-full sm:w-[400px] z-[2000] shadow-2xl overflow-y-auto border-l border-slate-800"
          style={{ backgroundColor: COLORS.bgCard }}
        >
          {/* Header Image */}
          <div className="relative h-56 w-full bg-slate-900">
            <img 
              src={cafe.imageUrl || getCafeImageUrl(cafe.name, 800, 600)} 
              alt={cafe.name} 
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                // Fallback to coffee image if original fails to load
                const target = e.target as HTMLImageElement;
                if (target.src !== getCafeImageUrl(cafe.name, 800, 600)) {
                  target.src = getCafeImageUrl(cafe.name, 800, 600);
                }
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] to-transparent"></div>
            
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-950/50 hover:bg-slate-950/70 text-white backdrop-blur-sm transition-colors border border-white/5"
            >
              <X size={20} />
            </button>

            <div className="absolute bottom-4 left-6">
                <div className="flex items-center gap-2 mb-1">
                    <span className="bg-amber-500 text-slate-900 text-xs font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Star size={10} fill="#0f172a" stroke="none" /> {cafe.rating}
                    </span>
                    {cafe.isOpen ? (
                        <span className="text-emerald-400 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/30">
                            Open Now
                        </span>
                    ) : (
                         <span className="text-rose-400 text-xs font-medium px-2 py-0.5 rounded-full bg-rose-950/60 border border-rose-500/30">
                            Closed
                        </span>
                    )}
                </div>
                <h2 className="text-2xl font-bold" style={{ color: COLORS.textPrimary }}>
                    {cafe.name}
                </h2>
            </div>
          </div>

          <div className="p-6 space-y-8">
            {/* Address */}
            <div>
                <p className="text-sm leading-relaxed" style={{ color: COLORS.textSecondary }}>
                    {cafe.address}
                </p>
            </div>

            <p className="text-sm leading-relaxed border-l-2 border-slate-700 pl-4 italic" style={{ color: COLORS.textSecondary }}>
                "{cafe.description}"
            </p>
            
            {/* Work Vibe Highlights (New UX Improvement) */}
            <div>
                 <h3 className="text-xs font-bold uppercase tracking-wider mb-3 text-slate-500">
                    Work Vibe
                </h3>
                <div className="flex flex-wrap gap-2">
                    {cafe.amenities.wifi >= 8 && (
                         <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            🚀 Fast Wifi
                         </span>
                    )}
                     {cafe.amenities.noise >= 8 && (
                         <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-violet-500/20 text-violet-400 border border-violet-500/30 flex items-center gap-1">
                            🤫 Quiet Zone
                         </span>
                    )}
                     {cafe.amenities.outlet >= 8 && (
                         <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                            ⚡ Many Plugs
                         </span>
                    )}
                     {cafe.amenities.comfort >= 8 && (
                         <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center gap-1">
                            🛋️ Comfy Seats
                         </span>
                    )}
                    {cafe.amenities.quality >= 8 && (
                         <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                            ☕ Top Tier Coffee
                         </span>
                    )}
                </div>
            </div>

            {/* Score Cards (The "Traffic Light" System) */}
            <div>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-4 text-slate-500">
                    Detailed Scores
                </h3>
                <div className="grid grid-cols-1 gap-3">
                    {(Object.keys(AMENITY_CONFIG) as AmenityKey[]).map((key) => {
                        const config = AMENITY_CONFIG[key];
                        const score = cafe.amenities[key];
                        const styles = getScoreColor(score);
                        const Icon = config.icon;

                        return (
                            <div 
                                key={key} 
                                className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800/50"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${styles.bg} ${styles.text}`}>
                                        <Icon size={18} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>
                                            {config.label}
                                        </span>
                                        <span className="text-[10px]" style={{ color: COLORS.textSecondary }}>
                                            {config.description}
                                        </span>
                                    </div>
                                </div>
                                
                                {/* Score Indicator */}
                                <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${styles.bg} ${styles.border}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${styles.dot}`}></div>
                                    <span className={`text-sm font-bold ${styles.text}`}>
                                        {score}/10
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

             {/* Footer Actions / Reviews */}
             <div className="pt-4 border-t border-slate-800">
                
                {/* Rate & Earn Points Button (Replaces Write Review) */}
                {hasUserAddedThisPlace ? (
                  <div className="w-full py-4 rounded-xl font-bold text-slate-300 bg-slate-800/50 border border-slate-700 mb-6 flex items-center justify-center gap-2 uppercase tracking-wide text-sm">
                    <Star size={18} className="text-slate-400" /> You Already Added This Place
                  </div>
                ) : !isWriting ? (
                   <button 
                     onClick={() => {
                       if (!isWalletConnected) {
                         alert('Please connect your Walrus wallet first!');
                         return;
                       }
                       setIsWriting(true);
                     }}
                     disabled={!isWalletConnected}
                     className="w-full py-4 rounded-xl font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(34,211,238,0.4)] mb-6 flex items-center justify-center gap-2 uppercase tracking-wide text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                       <Star size={18} className="fill-slate-950 stroke-slate-950" /> Rate & Earn Points
                   </button>
                ) : (
                   <motion.div 
                     initial={{ opacity: 0, height: 0 }}
                     animate={{ opacity: 1, height: 'auto' }}
                     className="mb-6 bg-slate-900/50 p-4 rounded-xl border border-slate-700"
                   >
                      <h4 className="text-sm font-bold text-white mb-3">Your Review & Ratings</h4>
                      
                      {/* Rating Sliders */}
                      <div className="space-y-3 mb-4">
                        {AMENITY_KEYS.map((key) => {
                          const config = AMENITY_CONFIG[key];
                          const Icon = config.icon;
                          const value = ratings[key];
                          
                          return (
                            <div key={key} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Icon size={14} className="text-slate-400" />
                                  <span className="text-xs text-slate-300">{config.label}</span>
                                </div>
                                <span className="text-xs font-mono text-cyan-400">{value}/10</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="10"
                                step="1"
                                value={value}
                                onChange={(e) => setRatings({ ...ratings, [key]: parseInt(e.target.value) })}
                                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                              />
                            </div>
                          );
                        })}
                      </div>
                      
                      <textarea
                        value={newReviewText}
                        onChange={(e) => setNewReviewText(e.target.value)}
                        placeholder="Share your experience..."
                        className="w-full bg-slate-800 text-slate-200 text-sm p-3 rounded-lg border border-slate-700 focus:border-cyan-500 focus:outline-none min-h-[80px] mb-3"
                      />
                      <div className="flex gap-2 justify-end">
                         <button 
                           onClick={() => setIsWriting(false)}
                           disabled={isSubmitting}
                           className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                         >
                           Cancel
                         </button>
                         <button 
                           onClick={handlePostReview}
                           disabled={isSubmitting || !newReviewText.trim() || !receiptImage}
                           className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-900 text-xs font-bold rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                           {isSubmitting ? (
                             <>
                               <Loader2 size={12} className="animate-spin" /> Submitting...
                             </>
                           ) : (
                             <>
                               <Send size={12} /> Post to Blockchain
                             </>
                           )}
                         </button>
                      </div>
                   </motion.div>
                )}

                {/* Recent Reviews List */}
                <div>
                   <h3 className="text-xs font-bold uppercase tracking-wider mb-4 text-slate-500 flex items-center justify-between">
                       Recent Reviews <span className="text-slate-600 font-mono text-[10px]">{reviews.length}</span>
                   </h3>
                   <div className="space-y-4">
                      {reviews.length > 0 ? reviews.map((review) => (
                        <div key={review.id} className="flex gap-3 pb-4 border-b border-slate-800/50 last:border-0">
                           <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 text-slate-400">
                              {review.userAvatar ? (
                                <img src={review.userAvatar} alt="user" className="w-full h-full rounded-full object-cover" />
                              ) : (
                                <User size={14} />
                              )}
                           </div>
                           <div>
                              <div className="flex items-center gap-2 mb-1">
                                 <span className="text-sm font-bold text-slate-200">{review.userName}</span>
                                 <div className="flex items-center">
                                    {[...Array(5)].map((_, i) => (
                                       <Star 
                                         key={i} 
                                         size={10} 
                                         className={i < review.rating ? "fill-amber-400 text-amber-400" : "fill-slate-700 text-slate-700"} 
                                       />
                                    ))}
                                 </div>
                                 {/* Verification Badges */}
                                 <div className="flex items-center gap-1 ml-2 flex-wrap">
                                   {review.isVerifiedVisit && (
                                     <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-full flex items-center gap-1">
                                       📍 Verified Visit
                                     </span>
                                   )}
                                   {review.verifiedByReceipt && !review.isSuspiciousReceipt && (
                                     <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1">
                                       🧾 Receipt
                                     </span>
                                   )}
                                   {review.isSuspiciousReceipt && (
                                     <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full flex items-center gap-1">
                                       ⚠ Suspicious
                                     </span>
                                   )}
                                 </div>
                              </div>
                              <p className="text-xs text-slate-400 leading-relaxed">{review.text}</p>
                              <span className="text-[10px] text-slate-600 mt-1 block">{review.date}</span>
                           </div>
                        </div>
                      )) : (
                        <div className="text-center py-4 text-slate-600 text-xs italic">
                           No reviews yet. Be the first!
                        </div>
                      )}
                   </div>
                </div>

             </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
