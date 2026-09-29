# AGENTS.md

## Coding style (user preference — always follow)

Write **plain, explicit code**. Match the style the user writes — see
`backend/app/routers/drivers.py` as the reference example.

- No `**kwargs` unpacking (e.g. `Product(**body.model_dump())`) — assign
  fields explicitly, one per line
- No `model_config`, alias tricks, or metaprogramming — keep it obvious
- Prefer a plain `for` loop building a list over dense comprehensions when
  the line gets long
- 404s: `raise HTTPException(status_code=404, detail="...")` (as in
  drivers.py), not the `api_error` helper
- Role guards: `Depends(require_role("admin"))` / `Depends(get_current_user)`
- DB: `db: Session = Depends(get_db)` in routers; `SessionLocal()` in scripts
- Keep endpoints step-by-step: query → check → act → commit → return

## Repo facts

- Backend: `backend/`, run uvicorn from there (`uvicorn app.main:app --reload`)
- `.env` lives at `backend/.env` — never commit
- `users` = staff only (admin/dispatcher/ops_manager/driver); `customers` is
  a separate table owning PIN/OTP state
- API prefix `/api/v1`; JSON snake_case; error envelope `{error:{code,message}}`
- `legacy_code/` is reference-only — port logic, never patch or run it
- Model files: singular names (`user.py`, `order.py`) — except `products.py`
