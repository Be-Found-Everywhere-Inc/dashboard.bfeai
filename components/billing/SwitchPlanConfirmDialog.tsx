'use client';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
} from '@bfeai/ui';

type CurrentSub = { name: string; price: number };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSubs: CurrentSub[];
  newPlanName: string;
  newPlanPrice: number;
  isTrialMidUpgrade?: boolean;
  daysRemainingInTrial?: number;
  onConfirm: () => void;
}

export function SwitchPlanConfirmDialog({
  open,
  onOpenChange,
  currentSubs,
  newPlanName,
  newPlanPrice,
  isTrialMidUpgrade,
  daysRemainingInTrial,
  onConfirm,
}: Props) {
  let copy: string;

  if (isTrialMidUpgrade && daysRemainingInTrial != null) {
    copy = `Your Lite trial ends in ${daysRemainingInTrial} days. Switching to ${newPlanName} ($${newPlanPrice}/mo) now ends the trial and starts your ${newPlanName} subscription immediately. Your trial credits will be added to your new plan.`;
  } else if (currentSubs.length === 0) {
    copy = `Subscribe to ${newPlanName} for $${newPlanPrice}/month?`;
  } else if (currentSubs.length === 1) {
    const c = currentSubs[0];
    copy = `You currently have ${c.name} ($${c.price}/mo). Switching to ${newPlanName} ($${newPlanPrice}/mo) will replace your current subscription immediately. You'll keep all your credits.`;
  } else {
    const subsList = currentSubs.map((s) => `${s.name} ($${s.price}/mo)`).join(' and ');
    const replacement = currentSubs.length === 2 ? 'both' : 'all';
    copy = `You currently have ${subsList}. Switching to ${newPlanName} ($${newPlanPrice}/mo) will replace ${replacement} subscriptions immediately. You'll keep all your credits.`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm plan change</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{copy}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
