use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Math overflow")] 
    Overflow,
    #[msg("Check-in too frequent")]
    TooFrequentCheckIn,
}