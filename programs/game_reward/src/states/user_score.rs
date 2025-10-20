use anchor_lang::prelude::*;

#[account]
pub struct UserScore {
    pub user: Pubkey,
    pub points: u64,
    pub claimed: bool,
    pub approved: bool,
    pub last_checkin_ts: u64,
}

impl UserScore {
    pub const LEN: usize = 8 + 32 + 8 + 1 + 1 + 8;
}