"use client";

import { useState } from "react";

type Step = {
  number: number;
  step: string;
};

type InstructionSet = {
  name: string;
  steps: Step[];
};

// Check-off state is purely local/ephemeral (not persisted) - it's a
// cooking-progress aid for the current visit, not data anyone else needs
// to see.
export default function InstructionsChecklist({
  instructionSets,
}: {
  instructionSets: InstructionSet[];
}) {
  const [checkedSteps, setCheckedSteps] = useState<Set<string>>(new Set());

  function toggleStep(key: string) {
    setCheckedSteps((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {instructionSets.map((set, setIndex) => (
        <div key={setIndex}>
          {set.name && <h3 className="mb-1 text-sm font-semibold text-gray-700">{set.name}</h3>}
          <ul className="flex flex-col gap-2">
            {set.steps.map((step) => {
              const key = `${setIndex}-${step.number}`;
              const isChecked = checkedSteps.has(key);
              return (
                <li key={key} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleStep(key)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
                  />
                  <span className={isChecked ? "text-gray-400 line-through" : "text-gray-700"}>
                    {step.number}. {step.step}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
