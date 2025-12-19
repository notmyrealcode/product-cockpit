/**
 * Formats rework feedback and appends it to the existing task description.
 *
 * @param existingDescription - The current task description (may be empty)
 * @param feedback - The rework feedback to append
 * @returns The updated description with formatted rework section
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

  const reworkSection = `---
**Rework requested** (${formattedDate} ${formattedTime}):
${feedback.trim()}`;

  if (!existingDescription || existingDescription.trim() === '') {
    return reworkSection;
  }

  return `${existingDescription.trim()}\n\n${reworkSection}`;
}
