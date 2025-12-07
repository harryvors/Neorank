/// Review Points Module
/// 
/// This module manages on-chain user points for reviews.
/// Each successful review awards 100 points (default, configurable).
/// 
/// Implementation: Each award creates a new UserPoints object owned by the user.
/// Frontend queries all UserPoints objects for a user's address and sums them up.
/// Alternatively, frontend can query PointsAwardedEvent events and sum the amounts.

module reviews::review_points {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;

    /// UserPoints object - stores points awarded in a single transaction
    /// Each review creates a new UserPoints object with amount = 100
    /// Frontend queries all UserPoints objects for a user and sums them
    struct UserPoints has key, store {
        id: UID,
        owner: address,
        amount: u64, // Points awarded in this transaction
        timestamp: u64, // When points were awarded
    }

    /// Event emitted when points are awarded
    /// Frontend can query these events to calculate total points
    struct PointsAwardedEvent has copy, drop {
        owner: address,
        amount: u64,
        timestamp: u64,
        blob_id: vector<u8>, // Walrus blob ID for this review (optional)
    }

    /// Award points to a user for submitting a review
    /// 
    /// Creates a new UserPoints object with the awarded amount.
    /// The frontend will query all UserPoints objects for this address
    /// and sum them to get the total points.
    /// 
    /// # Arguments
    /// * `recipient` - The signer who will receive the points
    /// * `amount` - Amount of points to award (default: 100)
    /// * `ctx` - Transaction context
    public entry fun award_points_for_review(
        recipient: &signer,
        amount: u64,
        ctx: &mut TxContext
    ) {
        let owner = tx_context::sender(ctx);
        let timestamp = tx_context::epoch_timestamp_ms(ctx);
        
        // Create a new UserPoints object for this award
        let points = UserPoints {
            id: object::new(ctx),
            owner,
            amount,
            timestamp,
        };
        
        // Transfer to owner (they own this object)
        transfer::transfer(points, owner);
        
        // Emit event for easy querying
        event::emit(PointsAwardedEvent {
            owner,
            amount,
            timestamp,
            blob_id: vector::empty<u8>(), // Empty if no blob ID
        });
    }

    /// Award points with Walrus blob ID
    /// 
    /// Same as award_points_for_review, but includes the Walrus blob ID
    /// in the event for tracking which review earned the points.
    public entry fun award_points_with_blob(
        recipient: &signer,
        amount: u64,
        blob_id: vector<u8>,
        ctx: &mut TxContext
    ) {
        let owner = tx_context::sender(ctx);
        let timestamp = tx_context::epoch_timestamp_ms(ctx);
        
        let points = UserPoints {
            id: object::new(ctx),
            owner,
            amount,
            timestamp,
        };
        
        transfer::transfer(points, owner);
        
        event::emit(PointsAwardedEvent {
            owner,
            amount,
            timestamp,
            blob_id,
        });
    }

    /// Get amount from a UserPoints object
    public fun get_amount(points: &UserPoints): u64 {
        points.amount
    }

    /// Get owner address from a UserPoints object
    public fun get_owner(points: &UserPoints): address {
        points.owner
    }

    /// Get timestamp from a UserPoints object
    public fun get_timestamp(points: &UserPoints): u64 {
        points.timestamp
    }
}

