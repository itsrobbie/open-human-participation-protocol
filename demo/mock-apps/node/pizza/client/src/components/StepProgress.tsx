interface StepProgressProps {
  currentStep: number;
  totalSteps: number;
  stepNames: string[];
}

export function StepProgress({ currentStep, totalSteps, stepNames }: StepProgressProps) {
  return (
    <div className="flex items-center gap-1" data-testid="step-progress">
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNum = i + 1;
        const isComplete = stepNum < currentStep;
        const isCurrent = stepNum === currentStep;

        return (
          <div key={stepNum} className="flex items-center gap-1 flex-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                isComplete
                  ? 'bg-green-500 text-white'
                  : isCurrent
                    ? 'bg-amber-500 text-white'
                    : 'bg-stone-200 dark:bg-stone-700 text-stone-500'
              }`}
              title={stepNames[i]}
              data-testid={`step-${stepNum}`}
            >
              {isComplete ? '✓' : stepNum}
            </div>
            {stepNum < totalSteps && (
              <div className={`flex-1 h-0.5 ${isComplete ? 'bg-green-500' : 'bg-stone-200 dark:bg-stone-700'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
