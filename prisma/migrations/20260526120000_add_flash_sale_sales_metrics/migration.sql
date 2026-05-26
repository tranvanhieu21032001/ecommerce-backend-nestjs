ALTER TABLE "flash_sale_items"
ADD COLUMN "orderCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "flash_sale_items" AS item
SET
  "soldCount" = metrics."soldCount",
  "orderCount" = metrics."orderCount",
  "revenue" = metrics."revenue"
FROM (
  SELECT
    order_item."flashSaleItemId" AS "itemId",
    SUM(order_item."quantity")::INTEGER AS "soldCount",
    COUNT(DISTINCT order_item."orderId")::INTEGER AS "orderCount",
    SUM(order_item."price" * order_item."quantity") AS "revenue"
  FROM "order_items" AS order_item
  INNER JOIN "orders" AS sale_order ON sale_order."id" = order_item."orderId"
  WHERE order_item."flashSaleItemId" IS NOT NULL
    AND sale_order."status" <> 'CANCELLED'
  GROUP BY order_item."flashSaleItemId"
) AS metrics
WHERE item."id" = metrics."itemId";
