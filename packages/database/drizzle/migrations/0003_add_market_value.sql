ALTER TABLE "properties" ADD COLUMN "market_value" bigint;--> statement-breakpoint
-- Merge the two value columns. `current_value` wins because that is the order
-- the app already resolved them in, so no property changes what it is worth.
UPDATE "properties" SET "market_value" = COALESCE("current_value", "estimated_market_value");--> statement-breakpoint
-- `original_purchase_price` meant the same as `purchase_price` for a property
-- already owned. Keep it where the price was never filled in, so nothing typed
-- is lost when the column goes.
UPDATE "properties" SET "purchase_price" = "original_purchase_price" WHERE "purchase_price" = 0 AND "original_purchase_price" IS NOT NULL;--> statement-breakpoint
-- Scenario overrides are jsonb, so the renamed key has to be carried across too.
UPDATE "property_scenarios" SET "overrides" = ("overrides" - 'estimatedMarketValue') || jsonb_build_object('marketValue', "overrides" -> 'estimatedMarketValue') WHERE "overrides" ? 'estimatedMarketValue';
