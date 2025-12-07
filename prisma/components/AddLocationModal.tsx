
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Send, Loader2 } from 'lucide-react';
import { COLORS, AMENITY_KEYS, AMENITY_CONFIG } from '../../constants';
import { AddressAutocompleteInput, SelectedAddress } from './AddressAutocompleteInput';
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { submitReviewTransaction, ReviewTransactionData } from '../../lib/sui-transaction';
import { CreateReviewRequest, CreateReviewResponse } from '../../types';
import { PointsEarnedModal } from './PointsEarnedModal';
import { usePoints } from '../../contexts/PointsContext';

interface AddLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationAdded?: (cafe: {
    id: string;
    name: string;
    address: string;
    coordinates: [number, number];
    rating: number;
    amenities: Record<string, number>;
  }) => void;
  onReviewPosted?: () => void; // Callback when review is posted (for points refresh)
}

export const AddLocationModal: React.FC<AddLocationModalProps> = ({ isOpen, onClose, onLocationAdded, onReviewPosted }) => {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const walletAddress = currentAccount?.address || null;
  const isWalletConnected = !!currentAccount;
  const { addPoints, refreshPoints, balance } = usePoints(); // Global points state

  const [cafeName, setCafeName] = useState('');
  const [district, setDistrict] = useState('');
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [showPointsEarned, setShowPointsEarned] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [newTotalPoints, setNewTotalPoints] = useState(0);

  const handleSliderChange = (key: string, value: number) => {
    setScores(prev => ({ ...prev, [key]: value }));
  };

  /**
   * Get GPS location and auto-fill address fields when modal opens
   */
  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setCafeName('');
      setDistrict('');
      setAddress('');
      setCoordinates(null);
      setComment('');
      setIsLoadingLocation(false);
      return;
    }

    if (!isWalletConnected) {
      // Don't fetch location if wallet is not connected
      return;
    }

    const fetchLocationAndAddress = async () => {
      setIsLoadingLocation(true);
      try {
        const { getCurrentLocation } = await import('../../lib/geolocation');
        const { reverseGeocode } = await import('../../lib/geocoding');
        
        // Get GPS location
        let location = await getCurrentLocation(1);
        
        if (!location) {
          // Retry once if failed
          const retry = window.confirm(
            'Konum bilgisi alınamadı. Adres alanlarını otomatik doldurmak için konum izni gerekiyor.\n\n' +
            'Tekrar denemek ister misiniz?'
          );
          if (retry) {
            location = await getCurrentLocation(1);
          }
        }
        
        if (location) {
          // Reverse geocoding: Convert coordinates to address
          const addressInfo = await reverseGeocode(location.lat, location.lng);
          
          if (addressInfo) {
            // Auto-fill address fields
            setCoordinates([location.lat, location.lng]);
            setAddress(addressInfo.fullAddress || '');
            
            // District/City
            if (addressInfo.district) {
              setDistrict(addressInfo.district);
            } else if (addressInfo.city) {
              setDistrict(addressInfo.city);
            }
            
            console.log('Address fields auto-filled from GPS:', {
              address: addressInfo.fullAddress,
              district: addressInfo.district || addressInfo.city,
            });
          } else {
            // If reverse geocoding fails, at least set coordinates
            setCoordinates([location.lat, location.lng]);
          }
        }
      } catch (error) {
        console.error('Error fetching location:', error);
      } finally {
        setIsLoadingLocation(false);
      }
    };
    
    fetchLocationAndAddress();
  }, [isOpen, isWalletConnected]);

  /**
   * Handle address selection from autocomplete
   * Automatically fills District / City fields if available
   */
  const handleAddressSelected = (selectedAddress: SelectedAddress) => {
    setAddress(selectedAddress.fullAddress || '');
    
    // Auto-fill district and city if available
    if (selectedAddress.district) {
      setDistrict(selectedAddress.district);
    } else if (selectedAddress.city) {
      setDistrict(selectedAddress.city);
    }
    
    // Store coordinates for map placement
    if (selectedAddress.lat && selectedAddress.lng) {
      setCoordinates([selectedAddress.lat, selectedAddress.lng]);
    }
  };

  /**
   * Handle form submission with blockchain integration
   * First signs Sui transaction, then saves to backend/Walrus
   */
  const handleSubmit = async () => {
    // Validation
    if (!cafeName.trim()) {
      alert('Lütfen kafe adını girin!');
      return;
    }

    // Address ve coordinates GPS'ten otomatik dolduruldu, kontrol et
    if (!coordinates) {
      alert('Konum bilgisi alınamadı! Lütfen sayfayı yenileyip tekrar deneyin.');
      return;
    }

    // Check wallet connection
    if (!isWalletConnected || !walletAddress) {
      alert('Lütfen önce cüzdanınızı bağlayın!');
      return;
    }

    setIsSubmitting(true);

    try {
      // Step 0: GPS verification - coordinates should already be set from useEffect
      // But verify that we have valid coordinates
      if (!coordinates) {
        alert('Konum bilgisi bulunamadı! Lütfen sayfayı yenileyip tekrar deneyin.');
        setIsSubmitting(false);
        return;
      }
      
      // Import geolocation functions for distance check (if needed)
      const { getCurrentLocation, calculateDistance } = await import('../../lib/geolocation');
      
      // Verify current GPS location matches the coordinates (150m check)
      // Bu kontrol, kullanıcının gerçekten o konumda olduğunu doğrular
      const currentLocation = await getCurrentLocation(1);
      
      if (!currentLocation) {
        alert('❌ Yorum reddedildi\n\nKonum bilgisi alınamadı! Değerlendirme yapabilmek için konum izni vermeniz gerekiyor.');
        setIsSubmitting(false);
        return;
      }
      
      // Girilen adres koordinatları ile kullanıcının gerçek GPS konumu arasındaki mesafeyi hesapla
      const distance = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        coordinates[0],
        coordinates[1]
      );
      
      // Eğer kullanıcı 150 metreden uzaktaysa, yorum reddedilir
      if (distance > 150) {
        alert(
          `❌ Yorum reddedildi\n\n` +
          `Girdiğiniz mekan konumuna 150 metreden uzaktasınız. Yeni mekan ekleyebilmek için kaydedilen konumun 150 metre içinde olmanız gerekiyor.\n\n` +
          `Sizin konumunuz: ${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}\n` +
          `Mekan konumu: ${coordinates[0].toFixed(6)}, ${coordinates[1].toFixed(6)}\n` +
          `Mesafe: ${Math.round(distance)} metre\n\n` +
          `Lütfen mekanın gerçek konumunda olduğunuzdan emin olun.`
        );
        setIsSubmitting(false);
        return;
      }
      
      // Check daily review limit BEFORE submitting
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
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
      // If no coordinates from address selection, use default Istanbul center
      const finalCoordinates: [number, number] = coordinates || [41.0082, 28.9784];

      // Calculate average rating from amenities (convert 0-10 to 1-5 scale)
      // If no scores provided, use default values
      const defaultScores: Record<string, number> = {
        wifi: 5,
        outlet: 5,
        comfort: 5,
        hygiene: 5,
        quality: 5,
        noise: 5,
        service: 5,
      };
      const finalScores = Object.keys(scores).length > 0 ? scores : defaultScores;
      const amenityValues = Object.values(finalScores) as number[];
      const avgScore = amenityValues.reduce((a, b) => a + b, 0) / amenityValues.length;
      const rating = Math.round((avgScore / 10) * 5); // Convert 0-10 to 1-5 scale

      // Generate unique ID for the new location
      const locationId = `user-${Date.now()}`;

      // Step 0.5: Get current user points to include in on-chain transaction
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

      // Step 1: Prepare location data for Sui transaction (includes current total points)
      const locationData: ReviewTransactionData = {
        placeId: locationId,
        placeName: cafeName.trim(),
        walletAddress: walletAddress,
        rating: Math.max(1, Math.min(5, rating)),
        comment: comment.trim() || `New location added: ${cafeName.trim()}`,
        coordinates: [finalCoordinates[0], finalCoordinates[1]], // [lat, lng]
        address: address.trim() || undefined,
        timestamp: Date.now(),
        totalPoints: currentTotalPoints, // Mevcut toplam puan (blockchain'e kaydedilecek)
      };

      // Step 2: Sign Sui transaction FIRST (user must sign before submitting)
      console.log('Requesting user signature for new location...');
      const transactionDigest = await submitReviewTransaction(
        locationData,
        signAndExecute
      );

      console.log('Sui transaction signed successfully:', transactionDigest);

      // Step 3: After successful signature, send to backend (which will upload to Walrus)
      const reviewRequest: CreateReviewRequest = {
        placeId: locationId,
        placeName: cafeName.trim(),
        lat: finalCoordinates[0],
        lng: finalCoordinates[1],
        rating: Math.max(1, Math.min(5, rating)),
        comment: comment.trim() || `New location added: ${cafeName.trim()}`,
        walletAddress: walletAddress,
        transactionDigest: transactionDigest,
      };

      // Add GPS location to request (use currentLocation from GPS verification above)
      const reviewRequestWithGPS = {
        ...reviewRequest,
        gpsLatitude: currentLocation.lat,
        gpsLongitude: currentLocation.lng,
        gpsDistance: distance, // Already calculated above
      };

      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewRequestWithGPS),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to submit location to backend';
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
          
          // GPS verification failed - show "Yorum reddedildi" message
          if (errorType === 'GPSVerificationFailed' || errorType === 'GPSVerificationRequired') {
            alert(`❌ Yorum reddedildi\n\n${errorMessage}`);
            setIsSubmitting(false);
            return;
          }
        } catch (e) {
          // If response is not JSON, try to get text
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
        
        // Create a more descriptive error
        const fullError = new Error(errorMessage);
        (fullError as any).type = errorType;
        (fullError as any).status = response.status;
        (fullError as any).details = errorDetails;
        throw fullError;
      }

      let result: CreateReviewResponse;
      try {
        result = await response.json();
      } catch (e) {
        // If response is not JSON, try to get text
        const text = await response.text();
        throw new Error(`Invalid response from server: ${text || 'Empty response'}`);
      }
      console.log('Location saved to blockchain:', result);
      const { walrusId } = result;

      // Step 5: Award points on-chain (separate transaction)
      // This happens AFTER Walrus upload so we can include the blob ID
      console.log('Awarding points on-chain for successful review...');
      const POINTS_EARNED = 100; // Fixed amount per review
      
      // Update global points state IMMEDIATELY (optimistic update)
      // This ensures Profile and Shop modals show the new balance right away
      addPoints(POINTS_EARNED);
      console.log('[AddLocationModal] Added 100 points to global balance (optimistic update)');
      
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

      // Show points earned modal
      setPointsEarned(earnedPoints);
      setNewTotalPoints(updatedTotalPoints);
      setShowPointsEarned(true);

      // Refresh global points from on-chain after a delay
      setTimeout(() => {
        refreshPoints();
      }, 2000);

      // Trigger refresh in parent (App.tsx) to update Profile and Shop modals
      if (onReviewPosted) {
        onReviewPosted();
        setTimeout(() => {
          onReviewPosted(); // Refresh again after on-chain sync
        }, 2000);
      }

      // Step 4: Save to persistent places database (MVP persistence)
      try {
        const placeResponse = await fetch('/api/places', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: cafeName.trim(),
            lat: finalCoordinates[0],
            lng: finalCoordinates[1],
            city: district ? undefined : undefined, // Can be extracted from address if needed
            district: district.trim() || undefined,
            address: address.trim() || undefined,
            walrusBlobId: result.walrusId || undefined,
            suiTxDigest: transactionDigest || undefined,
            walletAddress: walletAddress || undefined,
          }),
        });

        if (placeResponse.ok) {
          const createdPlace = await placeResponse.json();
          console.log('Place saved to database:', createdPlace.id);
        } else {
          console.warn('Failed to save place to database, but continuing...');
        }
      } catch (placeError) {
        console.error('Error saving place to database:', placeError);
        // Continue even if place save fails
      }

      // Step 5: Create new cafe object for map display
      const newCafe = {
        id: locationId,
        name: cafeName.trim(),
        address: address.trim(),
        coordinates: finalCoordinates,
        rating: Math.max(1, Math.min(5, rating)),
        amenities: finalScores as Record<string, number>,
      };

      // Call callback to add location to map
      if (onLocationAdded) {
        onLocationAdded(newCafe);
      }

      // Reset form
      setCafeName('');
      setDistrict('');
      setAddress('');
      setCoordinates(null);
      setScores({});
      setComment('');
      setIsSubmitting(false);

      // Close modal
      onClose();

      // Show success message
      alert(`"${newCafe.name}" blockchain'e kaydedildi ve haritaya eklendi! Transaction: ${transactionDigest.slice(0, 10)}...`);
    } catch (error: any) {
      console.error('Failed to submit location:', error);
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
      let userMessage = 'Mekan kaydedilemedi';
      
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
      {isOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 shadow-2xl flex flex-col"
            style={{ backgroundColor: COLORS.bgCard }}
          >
             {/* Header */}
             <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 sticky top-0 z-10 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400">
                  <Plus size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Add Location</h2>
                  <p className="text-xs text-slate-400">Contribute a new spot to the map</p>
                </div>
              </div>
              <button 
                  onClick={onClose}
                  className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
                >
                  <X size={24} />
              </button>
            </div>

            {/* Form */}
            <div className="p-8 space-y-6">
                
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500">Cafe Name</label>
                        <input 
                            type="text" 
                            value={cafeName}
                            onChange={(e) => setCafeName(e.target.value)}
                            placeholder="e.g. Luna Coffee Lab" 
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-sm focus:border-emerald-500 outline-none transition-colors" 
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500">
                          District / City
                          {isLoadingLocation && <span className="ml-2 text-emerald-400 text-xs">(Konum alınıyor...)</span>}
                        </label>
                        <input 
                            type="text" 
                            value={district}
                            onChange={(e) => setDistrict(e.target.value)}
                            placeholder={isLoadingLocation ? "Konum alınıyor..." : "e.g. Beşiktaş"} 
                            disabled={isLoadingLocation}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-sm focus:border-emerald-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-slate-500">
                      Address
                      {isLoadingLocation && <span className="ml-2 text-emerald-400 text-xs">(Konum alınıyor...)</span>}
                    </label>
                    <AddressAutocompleteInput
                        value={address}
                        onChange={setAddress}
                        onAddressSelected={handleAddressSelected}
                        placeholder={isLoadingLocation ? "Konum alınıyor, adres otomatik doldurulacak..." : "Full street address (start typing to search)"}
                        disabled={isLoadingLocation}
                    />
                </div>

                 {/* Amenities Scoring */}
                 <div className="space-y-4 pt-4 border-t border-slate-800">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        Rate Amenities <span className="text-xs font-normal text-slate-500">(Slide to score 1-10)</span>
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                        {AMENITY_KEYS.map(key => {
                            const config = AMENITY_CONFIG[key];
                            const Icon = config.icon;
                            const score = scores[key] || 5;

                            return (
                                <div key={key} className="flex items-center gap-4 p-3 rounded-xl bg-slate-900/50 border border-slate-800">
                                    <div className="p-2 rounded-lg bg-slate-800 text-slate-400">
                                        <Icon size={18} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between mb-2">
                                            <span className="text-xs font-bold text-slate-300">{config.label}</span>
                                            <span className="text-xs font-mono text-emerald-400">{score}/10</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="0" 
                                            max="10" 
                                            step="1"
                                            value={score}
                                            onChange={(e) => handleSliderChange(key, parseInt(e.target.value))}
                                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                 </div>

                 {/* Comment Section */}
                 <div className="space-y-2 pt-4 border-t border-slate-800">
                    <label className="text-xs font-bold uppercase text-slate-500">Comment</label>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Share your experience about this location..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-sm focus:border-emerald-500 outline-none transition-colors min-h-[100px] resize-y"
                    />
                 </div>

                 {/* Rate Onchain Section */}
                 <div className="space-y-3 pt-4 border-t border-slate-800">
                    <h3 className="text-sm font-bold text-white">
                        Rate Onchain
                    </h3>
                    <button 
                        onClick={handleSubmit}
                        disabled={isSubmitting || !isWalletConnected}
                        className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {isSubmitting ? (
                          <Loader2 size={20} className="animate-spin" />
                        ) : (
                          <Send size={20} />
                        )}
                    </button>
                    {!isWalletConnected && (
                      <p className="text-xs text-center text-rose-400">
                        Lütfen önce cüzdanınızı bağlayın
                      </p>
                    )}
                 </div>

            </div>

          </motion.div>
        </div>
      )}

      {/* Points Earned Modal */}
      <PointsEarnedModal
        isOpen={showPointsEarned}
        onClose={() => setShowPointsEarned(false)}
        pointsEarned={pointsEarned}
        totalPoints={newTotalPoints}
        onPointsUpdated={() => {
          // Trigger refresh in parent (App.tsx) to update Profile and Shop modals
          if (onReviewPosted) {
            onReviewPosted();
          }
        }}
      />
    </AnimatePresence>
  );
};

