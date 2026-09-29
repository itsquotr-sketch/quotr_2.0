/**
 * End padding inside the onboarding form scrollport.
 * Desktop keeps the last control off the edge. Phone leaves room to scroll
 * that control above the software keyboard.
 */
export const onboardingFormScrollClass = "min-h-0 scroll-pb-8";

export const onboardingFormEndPadding =
  "pb-[max(6rem,env(safe-area-inset-bottom))] max-md:pb-[max(45svh,env(safe-area-inset-bottom))]";
