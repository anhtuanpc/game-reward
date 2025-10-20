use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint};
use crate::{states::{config::*, user_score::*}, errors::ErrorCode, constants::*};


pub fn handler(ctx: Context<Claim>) -> Result<()> {
    let user_score = &mut ctx.accounts.user_score;
    let config = &mut ctx.accounts.config;
    require!(user_score.points >= config.points_to_claim, ErrorCode::NotEnoughPoints);
    user_score.points = user_score.points.checked_sub(config.points_to_claim).ok_or(ErrorCode::Overflow)?;
    user_score.claimed = true;
    let vault_bump = ctx.bumps.vault_authority;
    let authority_seeds: [&[u8]; 2] = [PREFIX_VAULT.as_ref(), &[vault_bump]];
    let signer_seeds: &[&[&[u8]]] = &[&authority_seeds];
    let reward_amount: u64 = config.reward_amount;
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.user_ata.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(cpi_ctx, reward_amount)?;
    emit!(ClaimEvent { user: user_score.user, remaining_points: user_score.points, reward_amount });
    Ok(())
}


#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut, seeds = [b"user", user.key.as_ref()], bump)]
    pub user_score: Account<'info, UserScore>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(mut, token::mint = mint)]
    pub user_ata: Account<'info, TokenAccount>,
    #[account(mut, seeds = [PREFIX_VAULT.as_ref()], bump)]
    pub vault: Account<'info, TokenAccount>,
    /// CHECK: This is safe because we derive the PDA from the vault seeds and only use it as authority for token transfers
    #[account(seeds = [PREFIX_VAULT.as_ref()], bump)]
    pub vault_authority: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}


#[event]
pub struct ClaimEvent {
    pub user: Pubkey,
    pub remaining_points: u64,
    pub reward_amount: u64,
}