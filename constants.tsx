

import { 
  Wifi, 
  Plug, 
  Armchair, 
  Sparkles, 
  Coffee, 
  Volume2, 
  Zap,
  Landmark,
  Trees,
  Gem
} from 'lucide-react';
import { Cafe, AmenityKey, AmenityConfig } from './types';

// Palette - Midnight Navy Theme
export const COLORS = {
  bgMain: '#0f172a', // Lightened from #020617 to Slate 900 for better visibility
  bgCard: '#1e293b', // Slate 800
  textPrimary: '#f8fafc', // Slate 50
  textSecondary: '#94a3b8', // Slate 400
  accent: '#06b6d4', // Cyan 500
};

// Configuration for icons and labels
export const AMENITY_CONFIG: Record<AmenityKey, AmenityConfig> = {
  wifi: { label: 'Wi-Fi Speed', icon: Wifi, description: 'Download/Upload stability' },
  outlet: { label: 'Power Outlets', icon: Plug, description: 'Availability of plugs' },
  comfort: { label: 'Comfort', icon: Armchair, description: 'Seating ergonomics & space' },
  hygiene: { label: 'Hygiene', icon: Sparkles, description: 'Restroom & floor cleanliness' },
  quality: { label: 'Product Quality', icon: Coffee, description: 'Taste & variety' },
  noise: { label: 'Noise Level', icon: Volume2, description: 'High score = Quiet atmosphere' },
  service: { label: 'Service Speed', icon: Zap, description: 'Staff efficiency' },
};

export const AMENITY_KEYS = Object.keys(AMENITY_CONFIG) as AmenityKey[];

// Traffic Light Logic Helper - Updated for Blue Theme
export const getScoreColor = (score: number) => {
  // High: Cyan/Teal (Electric Blue look)
  if (score >= 8) return { 
    bg: 'bg-cyan-500/20', 
    text: 'text-cyan-400', 
    border: 'border-cyan-500/30', 
    dot: 'bg-cyan-400', 
    fill: 'fill-cyan-400' 
  };
  // Mid: Amber (Kept for warning)
  if (score >= 4) return { 
    bg: 'bg-amber-500/20', 
    text: 'text-amber-400', 
    border: 'border-amber-500/30', 
    dot: 'bg-amber-500', 
    fill: 'fill-amber-400' 
  };
  // Low: Rose (Softer Red)
  return { 
    bg: 'bg-rose-500/20', 
    text: 'text-rose-400', 
    border: 'border-rose-500/30', 
    dot: 'bg-rose-500', 
    fill: 'fill-rose-400' 
  };
};

// Location Panel Data
export const LOCATION_INFO = {
  title: "Beşiktaş",
  description: "The vibrant heart of Istanbul. Known for its lively breakfast streets, historic naval museum, and the roaring energy of the Black Eagles. A perfect blend of history, student culture, and premium coffee spots.",
  mustVisit: [
    { name: "Naval Museum", icon: Landmark },
    { name: "Dolmabahçe Palace", icon: Gem },
    { name: "Abbasağa Park", icon: Trees },
    { name: "Vodafone Park", icon: Zap },
  ]
};

// Mock User Profile Data
export const MOCK_USER = {
  name: "Alex 'Nomad'",
  handle: "@digital_nomad_99",
  avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop",
  level: "Level 7 • Elite Scout",
  points: 2450,
  stats: {
    reviews: 42,
    accuracy: "94%",
    discovered: 18,
    expertise: "Wi-Fi Expert"
  },
  rewards: [
    { id: 'r1', name: "Free Espresso", venue: "Nebula Roasters", code: "NEB-FREE" },
    { id: 'r2', name: "20% Off Pastry", venue: "Code & Brew", code: "DEV-20" }
  ]
};

// Shop Items - Anlaşmalı yerlerden talep etme hakkı
export const SHOP_ITEMS = [
  {
    id: 'nft1',
    name: 'Starbucks Free Coffee',
    description: 'Starbucks\'tan 1 bedava kahve hakkı. Anlaşmalı şubelerde geçerlidir.',
    cost: 500,
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&h=400&fit=crop',
    rarity: 'COMMON'
  },
  {
    id: 'nft2',
    name: 'Kahve Dünyası Premium Set',
    description: 'Kahve Dünyası\'ndan 1 kahve + 1 pasta hakkı. Anlaşmalı şubelerde geçerlidir.',
    cost: 1000,
    image: 'https://images.unsplash.com/photo-1563770095-39d468f95c3c?w=400&h=400&fit=crop',
    rarity: 'RARE'
  },
  {
    id: 'nft3',
    name: 'Gloria Jeans VIP Package',
    description: 'Gloria Jeans\'tan 2 kahve + 1 atıştırmalık hakkı. Anlaşmalı şubelerde geçerlidir.',
    cost: 1200,
    image: 'https://images.unsplash.com/photo-1614853316966-2679d9c28581?w=400&h=400&fit=crop',
    rarity: 'LEGENDARY'
  }
];

// Mock Data
export const INITIAL_CAFES: Cafe[] = [
  {
    id: '1',
    name: 'Nebula Roasters',
    address: '124 Cosmic Way, Beyoglu',
    rating: 4.8,
    coordinates: [41.0369, 28.9775],
    isOpen: true,
    description: "A dark, moody roastery perfect for deep work sessions. Excellent coffee, but can get crowded.",
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d4b2a99b8c9?w=800&h=600&fit=crop&auto=format&q=80',
    amenities: {
      wifi: 9,
      outlet: 8,
      comfort: 7,
      hygiene: 9,
      quality: 10,
      noise: 5,
      service: 8
    },
    reviews: [
        { id: 'r1', userName: 'Sarah K.', date: '2 days ago', rating: 5, text: 'Absolutely love the pour-over options here. Internet is blazing fast for uploads!' },
        { id: 'r2', userName: 'Mehmet Y.', date: '1 week ago', rating: 4, text: 'Great vibe, but hard to find a seat after 2 PM.' }
    ]
  },
  {
    id: '2',
    name: 'The Grind Station',
    address: '88 Railway Ave, Kadikoy',
    rating: 4.2,
    coordinates: [40.9901, 29.0291],
    isOpen: true,
    description: "Industrial chic vibe. Great for groups, but the wifi can be spotty during peak hours.",
    imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&h=600&fit=crop&auto=format&q=80',
    amenities: {
      wifi: 4,
      outlet: 9,
      comfort: 6,
      hygiene: 7,
      quality: 8,
      noise: 3,
      service: 9
    },
    reviews: [
        { id: 'r3', userName: 'John D.', date: '3 days ago', rating: 3, text: 'Wifi kept dropping during my call. Good coffee though.' },
        { id: 'r4', userName: 'Elif S.', date: '2 weeks ago', rating: 5, text: 'Love the interior design! Perfect for Instagram.' }
    ]
  },
  {
    id: '3',
    name: 'Zenith Lounge',
    address: '55 Sky Tower, Besiktas',
    rating: 4.9,
    coordinates: [41.0422, 29.0067],
    isOpen: false,
    description: "Premium workspace cafe. Absolute silence, ergonomic chairs, but pricey menu.",
    imageUrl: 'https://images.unsplash.com/photo-1447933601403-0c6681de3cd5?w=800&h=600&fit=crop&auto=format&q=80',
    amenities: {
      wifi: 10,
      outlet: 10,
      comfort: 10,
      hygiene: 10,
      quality: 9,
      noise: 10,
      service: 10
    },
    reviews: [
        { id: 'r5', userName: 'CoderX', date: 'Yesterday', rating: 5, text: 'The Herman Miller chairs are a game changer. Worth every penny.' }
    ]
  },
  {
    id: '4',
    name: 'Rusty Mug',
    address: '12 Old Port, Karakoy',
    rating: 3.8,
    coordinates: [41.0254, 28.9742],
    isOpen: true,
    description: "Charming vintage decor. Good for a quick chat, not for working all day.",
    imageUrl: 'https://images.unsplash.com/photo-1461020411469-80fdd6a19119?w=800&h=600&fit=crop&auto=format&q=80',
    amenities: {
      wifi: 2,
      outlet: 3,
      comfort: 5,
      hygiene: 6,
      quality: 7,
      noise: 2,
      service: 6
    },
    reviews: []
  },
  {
    id: '5',
    name: 'Code & Brew',
    address: '404 NotFound St, Sisli',
    rating: 4.5,
    coordinates: [41.0609, 28.9877],
    isOpen: true,
    description: "Designed by devs for devs. Fast internet, plenty of power, late night hours.",
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-9aa423b1d3c1?w=800&h=600&fit=crop&auto=format&q=80',
    amenities: {
      wifi: 10,
      outlet: 10,
      comfort: 8,
      hygiene: 8,
      quality: 6,
      noise: 7,
      service: 5
    },
    reviews: [
        { id: 'r6', userName: 'DevOps_Dave', date: '5 hours ago', rating: 5, text: 'Finally a place open past midnight with good wifi!' }
    ]
  }
];