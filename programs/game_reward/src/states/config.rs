use anchor_lang::prelude::*;

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub point_to_claim: u64,
    pub checkin_interval_seconds: u64,
    pub reward_amount: u64,
}

impl Config {
    pub const LEN: usize = 8 + 32 + 8 + 8 + 8;
}