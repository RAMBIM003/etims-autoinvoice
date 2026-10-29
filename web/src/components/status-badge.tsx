import { Badge } from "@/components/ui/badge";
import { statusLabel, tone } from "@/lib/format";

/** One mapping from the API's status words to a tint, used by every list. */
export function StatusBadge({ status, className }: { status: unknown; className?: string }) {
    const variant = tone(status);

    return (
        <Badge variant={variant === "default" ? "default" : variant} dot className={className}>
            {statusLabel(status)}
        </Badge>
    );
}
