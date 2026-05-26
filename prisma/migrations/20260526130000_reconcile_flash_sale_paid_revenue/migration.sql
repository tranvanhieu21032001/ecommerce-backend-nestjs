UPDATE "flash_sale_items" AS item
SET "revenue" = COALESCE(metrics."revenue", 0)
FROM (
  SELECT
    flash_item."id" AS "itemId",
    SUM(
      CASE
        WHEN payment."status" = 'COMPLETED' AND sale_order."status" <> 'CANCELLED'
          THEN order_item."price" * order_item."quantity"
        ELSE 0
      END
    ) AS "revenue"
  FROM "flash_sale_items" AS flash_item
  LEFT JOIN "order_items" AS order_item ON order_item."flashSaleItemId" = flash_item."id"
  LEFT JOIN "orders" AS sale_order ON sale_order."id" = order_item."orderId"
  LEFT JOIN "payments" AS payment ON payment."orderId" = sale_order."id"
  GROUP BY flash_item."id"
) AS metrics
WHERE item."id" = metrics."itemId";
