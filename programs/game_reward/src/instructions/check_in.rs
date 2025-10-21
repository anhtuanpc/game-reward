use anchor_lang::prelude::*;
use crate::states::user_score::*;
use crate::states::config::*;
use crate::errors::ErrorCode;

pub fn handler(ctx: Context<CheckIn>) -> Result<()> {
    let user_score = &mut ctx.accounts.user_score;
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;

    // init first time
    if user_score.user == Pubkey::default() {
        user_score.user = *ctx.accounts.user.key;
        user_score.points = 0;
        user_score.claimed = false;
        user_score.last_checkin_ts = 0;
    }

    // enforce rate-limit
    let last = user_score.last_checkin_ts as i64;
    if now - last < ctx.accounts.config.checkin_interval_seconds as i64 {
        return err!(ErrorCode::TooFrequentCheckIn);
    }

    user_score.points = user_score.points.checked_add(1).ok_or(ErrorCode::Overflow)?;
    user_score.last_checkin_ts = now as u64;

    emit!(CheckInEvent { user: user_score.user, points: user_score.points, timestamp: now });
    Ok(())
}

#[derive(Accounts)]
    pub struct CheckIn<'info> {
    #[account(mut, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(init_if_needed, payer = user, space = UserScore::LEN, seeds = [b"user", user.key.as_ref()], bump)]
    pub user_score: Account<'info, UserScore>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}


#[event]
    pub struct CheckInEvent {
    pub user: Pubkey,
    pub points: u64,
    pub timestamp: i64,
}