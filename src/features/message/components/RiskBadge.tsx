import { Badge } from '../../../shared/components/ui';
import { riskLabel, riskVariant } from '../messageRules';
import type { RiskLevel } from '../types';

type RiskBadgeProps = {
  level: RiskLevel;
};

export function RiskBadge({ level }: RiskBadgeProps) {
  return (
    <Badge
      className={`board-risk-badge board-risk-${level}`}
      size="sm"
      variant={riskVariant[level]}
    >
      {riskLabel[level]}
    </Badge>
  );
}
