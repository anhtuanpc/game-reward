use anchor_lang::prelude::*;
use crate::states::config::*;
use crate::constants::DEFAULT_CHECKIN_INTERVAL;

pub fn handler(ctx: Context<InitializeConfig>, points_to_claim: u64) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.admin = *ctx.accounts.admin.key;
    config.point_to_claim = points_to_claim;
    config.checkin_interval_seconds = DEFAULT_CHECKIN_INTERVAL;
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(init, payer = admin, space = Config::LEN, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}