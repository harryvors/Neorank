module reviews::reviews {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use std::string::{Self, String};
    use sui::event;

    /// Review object that stores a single review
    struct Review has key, store {
        id: UID,
        cafe_id: String,
        cafe_name: String,
        wallet_address: address,
        ratings: vector<u8>, // Serialized ratings JSON as bytes
        text: String,
        timestamp: u64,
        total_points: u64, // Kullanıcının review anındaki toplam puanı (on-chain'de saklanır)
    }

    /// Event emitted when a review is created
    struct ReviewCreated has copy, drop {
        cafe_id: String,
        wallet_address: address,
        timestamp: u64,
        total_points: u64, // Review anındaki toplam puan
    }

    /// Create a new review
    /// Arguments are passed as byte vectors and converted to strings
    /// total_points: Kullanıcının review anındaki toplam puanı (indirim kodu kullanımı için)
    public entry fun create_review(
        cafe_id: vector<u8>,
        cafe_name: vector<u8>,
        ratings: vector<u8>,
        text: vector<u8>,
        total_points: u64,
        ctx: &mut TxContext
    ) {
        let wallet_address = tx_context::sender(ctx);
        let timestamp = tx_context::epoch_timestamp_ms(ctx);
        
        // Convert byte vectors to strings
        let cafe_id_str = string::utf8(cafe_id);
        let cafe_name_str = string::utf8(cafe_name);
        let text_str = string::utf8(text);
        
        // Create review object
        let review = Review {
            id: object::new(ctx),
            cafe_id: cafe_id_str,
            cafe_name: cafe_name_str,
            wallet_address,
            ratings,
            text: text_str,
            timestamp,
            total_points, // Review anındaki toplam puanı sakla
        };
        
        // Transfer review to sender (they own it)
        transfer::transfer(review, wallet_address);
        
        // Emit event for indexing
        event::emit(ReviewCreated {
            cafe_id: cafe_id_str,
            wallet_address,
            timestamp,
            total_points, // Event'e de ekle
        });
    }

    /// Get review data (helper function for off-chain queries)
    public fun get_review_data(review: &Review): (String, String, address, vector<u8>, String, u64, u64) {
        (
            review.cafe_id,
            review.cafe_name,
            review.wallet_address,
            review.ratings,
            review.text,
            review.timestamp,
            review.total_points
        )
    }
    
    /// Get user's total points from their latest review (for discount code validation)
    /// Returns the total_points from the most recent review by this wallet
    public fun get_user_total_points(review: &Review): u64 {
        review.total_points
    }
}

