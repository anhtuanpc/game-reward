use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Math overflow")] 
    Overflow,
    #[msg("Check-in too frequent")]
    TooFrequentCheckIn,
    #[msg("Not enough points to claim")] 
    NotEnoughPoints,
    #[msg("Unauthorized: only admin can call")] 
    Unauthorized,
}