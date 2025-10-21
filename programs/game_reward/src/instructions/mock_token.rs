use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::constants::*;


pub fn create_mock_token_handler(_ctx: Context<CreateMockToken>, _decimals: u8) -> Result<()> {
    msg!("Mock mint created: {}", _ctx.accounts.mint.key());
    Ok(())
}


pub fn fund_vault_handler(ctx: Context<FundVault>, amount: u64) -> Result<()> {
    let cpi_ctx = CpiContext::new(
    ctx.accounts.token_program.to_account_info(),
    Transfer {
        from: ctx.accounts.admin_ata.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.admin.to_account_info(),
    },
    );
    token::transfer(cpi_ctx, amount)?;
    msg!("Vault funded with {} tokens", amount);
    Ok(())
}


#[derive(Accounts)]
pub struct CreateMockToken<'info> {
    #[account(init, payer = admin, mint::decimals = TOKEN_DECIMALS, mint::authority = admin, mint::freeze_authority = admin)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}


#[derive(Accounts)]
pub struct FundVault<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(mut)]
    pub admin_ata: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = admin,
        token::mint = mint,
        token::authority = vault_authority,
        seeds = [PREFIX_VAULT.as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    /// CHECK: vault authority PDA
    #[account(seeds = [PREFIX_VAULT.as_ref()], bump)]
    pub vault_authority: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}