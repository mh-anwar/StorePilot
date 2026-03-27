import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Product {
  productName: string;
  totalRevenue: string;
  totalUnits: string;
}

export function TopProductsTable({ products }: { products: Product[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Top Products</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {products.map((product, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs font-mono text-muted-foreground w-5">
                #{i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {product.productName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {product.totalUnits} units sold
                </p>
              </div>
              <Badge variant="secondary" className="font-mono">
                ${parseFloat(product.totalRevenue).toLocaleString()}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
