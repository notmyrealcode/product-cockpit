/**
 * Formats rework feedback and prepends it to the existing task description.
 * Rework feedback is placed at the top so LLMs see it first when reading the task.
 *
 * @param existingDescription - The current task description (may be empty)
 * @param feedback - The rework feedback to prepend
 * @returns The updated description with formatted rework section at the top
 */
export function formatReworkDescription(
  existingDescription: string | null | undefined,
  feedback: string
): string {
  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const reworkSection = `**Rework requested** (${formattedDate} ${formattedTime}):
${feedback.trim()}
---`;

  if (!existingDescription || existingDescription.trim() === '') {
    return reworkSection;
  }

  return `${reworkSection}\n\n${existingDescription.trim()}`;
}
