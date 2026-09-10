# Property

The property feature answers one question: **what would this purchase cost, and
what balance would I need to have?** Everything below serves that.

The planner is a what-if tool. You push the price and the deposit around and
watch the figures move. It is **standalone**: it never reads transactions or
account balances, because a balance here is `openingBalance + sum(imported
transactions)`, which lags the last CSV import and is silently low when an
opening balance was never set. That is fine for reviewing spending and wrong for
"do I have the deposit".

---

## 1. The principle

**This is not a stamp duty calculator. It is a configurable calculation engine
with a property purchase UI on top.**

`@repo/property` is a pure, zero-dependency package. It contains no country, no
state, no tax name and no cost list. Feed it a stamp duty table, a land tax table
or a registration fee schedule and it behaves identically. NSW rates are seed
data, not code.

The practical test: **supporting a new jurisdiction must never require a code
change.** If it would, the rule belongs in configuration instead.

---

## 2. Units

Two conventions, applied everywhere with no exceptions.

| Kind | Stored as | Example |
| --- | --- | --- |
| Money | Signed integer **minor units** (`bigint`, `mode: 'number'`) | `110000000` is $1,100,000.00 |
| Rates and percentages | **Decimal** doubles | `0.045` is 4.5%, `0.8` is 80% |

Users type major units and whole percentages. The conversion happens once, in
`packages/validation/src/property.ts`, so no component or action has to remember
it. Going the other way, `_lib/format.ts` rounds before display: `0.07 * 100` is
`7.000000000000001` in binary floating point, and that is what would otherwise
appear in the box.

---

## 3. The model

### Configuration, shared across properties

| Table | What it holds |
| --- | --- |
| `jurisdictions` | A place and what it calls its purchase tax. `AU-NSW` calls it "Transfer Duty"; nothing hard-codes that word |
| `cost_types` | Reusable cost **definitions**: "Building Inspection, normally $600", "Transfer Duty, bracketed" |
| `rate_schedules` | Dated bracket tables, grouped by charge (`transfer-tax`) and jurisdiction |
| `app_settings.property` | Calculation defaults: loan term, interest rate, deposit, vacancy, management, sensitivity rates, max portfolio LVR |

### Per property

| Table | What it holds |
| --- | --- |
| `properties` | The place, its jurisdiction, price, market value, status, and the frozen `rate_schedule_snapshot` once a purchase is locked |
| `property_loans` | Amount, rate, term, type, offset balance |
| `property_costs` | Which cost types apply to **this** property, and any overrides |
| `property_recurring_costs` | Holding costs, at whatever cadence the bill arrives |
| `property_rentals` | Rent, frequency, vacancy and management rates |
| `property_scenarios` | Named override sets, for comparison |
| `property_available_funds` | Money towards a purchase, typed in by hand |

### What a property is worth

Two money fields, and only two:

| Field | Means |
| --- | --- |
| `purchasePrice` | What is being paid, or what was paid for a property already owned |
| `marketValue` | What it would sell for **today** |

`propertyValue` is `marketValue ?? purchasePrice`, and LVR and equity measure
against that. Measuring against the value rather than the price is deliberate:
buying under valuation should show the better position it genuinely gives, and
the gap between the two is what portfolio impact reports as the amount that does
not come back as equity.

**Neither is a forecast.** Nothing in the app projects future value, so there is
no time dimension to either field. A value comes from a lender's valuation, an
appraisal, or comparable sales.

This replaced three fields. `estimatedMarketValue` and `currentValue` asked the
same question at two stages of ownership and were told apart by the status flag,
which left nobody able to say which one to fill in; `originalPurchasePrice`
duplicated `purchasePrice` for an owned property and was read by nothing at all.
The merge is in migrations `0003`/`0004`, keeping `currentValue` over the
estimate because that was the order the app already resolved them in.

### Definition versus instance

A **cost type** is the reusable definition. A **property cost** is what one
property says about it. They are combined at read time, so overriding a cost on
one property never edits the definition every other property uses.

A property cost resolves in this order, first hit winning:

1. `actualValue`, what was really paid
2. `overrideValue`, a deliberate correction
3. `manualValue`, for a cost type with no formula of its own
4. the calculated value, from the cost type's `calculationType`

Calculation types are `fixed`, `percentage`, `formula` and `bracketed`. Formulas
run through a hand-written tokeniser and recursive descent parser with an
allowlisted variable set. There is no `eval` and no `Function`.

---

## 4. Rate schedules

A schedule is a list of brackets with an effective date range, a version and a
group.

```
minimum        maximum        baseAmount    rate
0              16000          0             0.0125
16000          35000          200           0.015
...
1168000        null           50875         0.055
```

- `minimum` is **inclusive**, `maximum` is **exclusive**, so a contiguous
  schedule has exactly one matching band for any value.
- A `null` maximum makes the final bracket unlimited.
- The amount is `baseAmount + (value - minimum) * rate`, then raised to
  `minimumCharge` if the schedule sets one.

`validateRateSchedule` and `validateScheduleSet` refuse gaps, overlaps and
schedules whose dates collide with another version in the same group. The server
enforces this on save. Disabling the submit button in the browser is a
convenience, not the guard.

### Resolution by date, never by id

A cost type records the **group** it needs (`transfer-tax`), not a specific
schedule. The schedule in force is resolved from jurisdiction, group and the
purchase date at read time:

```
jurisdiction = AU-NSW
group        = transfer-tax
on           = purchase date, or today when there is none
```

That is what makes next year's rates a data change. Add the new schedule with
its `effectiveFrom`, and every property whose purchase date falls in the new
range picks it up. Nothing else is edited.

---

## 5. Snapshots, and why a completed purchase stops moving

A live schedule is right for a purchase you are planning and wrong for one that
already happened. If you correct a typo in the 2026/27 brackets, a purchase that
settled in 2026 must not silently change what it cost.

Locking a purchase writes a **snapshot** onto the property: the schedule id, its
key, name, version, date range, currency and a full copy of the brackets, plus
`takenAt`. From then on the planner reads the snapshot instead of the live
schedule. Reopening the purchase clears it and the property follows the live
schedules again.

The choice is made in exactly one place, `planner/page.tsx`:

```
completedAt set  ->  read property.rateScheduleSnapshot
otherwise        ->  resolve the schedule in force on the purchase date
```

This was verified by tampering: doubling the seeded NSW rates directly in the
database left a locked purchase at $39,187 while an unlocked one moved to
$84,772.

---

## 6. The planner

Everything on the page is **derived from working inputs held in the browser**,
not from the saved property. `usePlannerInputs` holds the values as the strings
the user typed, and `buildFinancing`, `summariseUpfrontCosts`, `buildOngoing` and
`summariseFunds` derive from them on every keystroke.

This matters most for transfer duty, which is bracketed **on the purchase price**.
It was once rendered on the server from the saved property, which left the
largest single upfront cost sitting still while the price moved.

**Saving stays a deliberate act.** Modelling a purchase writes nothing.

Two conventions the UI is explicit about, because both are reported
inconsistently in the wild:

- **Cash flow is shown before and after principal.** Principal is not an expense,
  it buys equity, but it does leave the bank account.
- **Year 1 interest is used**, not an average. Interest falls over the life of a
  loan, so the first year is the worst case and the one worth planning against.

---

## 7. Scenarios

A scenario is an **override set over the working inputs, not a copy**. It stores
only what it changes, so editing the property flows into every scenario instead
of leaving stale copies behind.

Overriding deposit, deposit percentage or loan amount also moves which of the
three the other two are derived from. Without that the override would be stored
and then ignored, because `deriveFinancing` reads only the field `source` names.

Each column runs through the same functions the live panels use, and the base
column is the scenario that overrides nothing. There is no second code path to
disagree with the panels.

Costs are recalculated per scenario rather than carried over. Duty at $1.1m is
not duty at $1.2m.

---

## 8. Portfolio

`portfolioTotals` counts everything except sold properties. Deciding whether a
**planned** purchase is part of what you hold is the caller's job, through
`ownedProperties`, because the two readings are both needed:

- The **portfolio page** counts only what is owned. "Debt owed" has to mean money
  actually borrowed.
- **Portfolio impact** needs both: what is owned today, and the same totals with
  the purchase added.

Impact reports value, debt, equity, portfolio LVR, borrowing headroom, and equity
gained less the cash it took. That last figure is usually negative, and its size
is the point: it is the upfront costs plus anything paid above the valuation.

Borrowing headroom needs a lending rule rather than a law of nature, so
`maxPortfolioLvr` is a setting.

---

## 9. Where things live

| Path | What |
| --- | --- |
| `packages/property/src` | The engine: brackets, formulas, costs, mortgage, rental, validation. Pure, zero dependency, no jurisdiction |
| `packages/property/src/defaults` | Seed data: cost types, categories, NSW schedules, calculation defaults |
| `packages/database/src/schema/property*.ts` | Tables |
| `packages/database/src/property-seed.ts` | Insert-only seeding, so a seeded row is the user's own copy and editing it is safe |
| `apps/web/src/app/app/property/_lib` | Turning stored rows into figures. Pure and unit tested |
| `apps/web/src/app/app/property/[propertyId]/planner` | The planner page, its panels and its server actions |
| `apps/web/src/app/app/settings/property` | Cost types, jurisdictions, rate schedules and calculation defaults |

---

See [architecture.md](architecture.md) for how the app is put together, and
[development.md](development.md) for running and testing it.
