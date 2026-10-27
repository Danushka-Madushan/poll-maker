import type { Poll, PollResult } from '../types/poll';

/**
 * Generates and downloads a high-resolution 1200x630 shareable PNG
 * of the poll winner and ranking results using HTML5 Canvas.
 * Adheres strictly to the Halloween Design System tokens:
 * --void (#0D0B10), --bone (#F4EEDF), --pumpkin (#FF6B00), --ink (#1A1620).
 */
export async function exportResultPNG(poll: Poll, result: PollResult): Promise<void> {
  const width = 1200;
  const height = 630;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. Background Void
  ctx.fillStyle = '#0D0B10';
  ctx.fillRect(0, 0, width, height);

  // 2. Subtle Halftone Pattern
  ctx.fillStyle = 'rgba(244, 238, 223, 0.04)';
  for (let x = 0; x < width; x += 24) {
    for (let y = 0; y < height; y += 24) {
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // 3. Hard Outer Border (6px bone)
  ctx.strokeStyle = '#F4EEDF';
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, width - 24, height - 24);

  // 4. Top Hazard Stripe Banner
  const stripeH = 14;
  for (let x = -20; x < width + 40; x += 28) {
    ctx.fillStyle = '#FF6B00';
    ctx.beginPath();
    ctx.moveTo(x, 15);
    ctx.lineTo(x + 14, 15);
    ctx.lineTo(x, 15 + stripeH);
    ctx.lineTo(x - 14, 15 + stripeH);
    ctx.closePath();
    ctx.fill();
  }

  // 5. Header Title
  ctx.fillStyle = '#F4EEDF';
  ctx.font = '900 20px "Space Mono", monospace';
  ctx.letterSpacing = '2px';
  ctx.fillText('HALLOWEEN POLL — OFFICIAL RESULT', 40, 60);

  ctx.fillStyle = '#FF6B00';
  ctx.font = '900 38px "Archivo Black", Impact, sans-serif';
  const displayTitle = poll.title.length > 35 ? poll.title.slice(0, 32) + '…' : poll.title;
  ctx.fillText(displayTitle.toUpperCase(), 40, 105);

  // 6. Winner Block (Left side)
  const winnerId = result.winners[0];
  const winnerOpt = poll.options.find((o) => o.id === winnerId);
  const winnerTally = result.tallies.find((t) => t.optionId === winnerId);

  // Draw Winner Image if present
  const imgBoxX = 40;
  const imgBoxY = 135;
  const imgBoxSize = 340;

  ctx.fillStyle = '#1A1620';
  ctx.fillRect(imgBoxX, imgBoxY, imgBoxSize, imgBoxSize);
  ctx.strokeStyle = '#FF6B00';
  ctx.lineWidth = 4;
  ctx.strokeRect(imgBoxX, imgBoxY, imgBoxSize, imgBoxSize);

  if (winnerOpt?.imageUrl) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve) => {
        img.onload = () => {
          ctx.drawImage(img, imgBoxX, imgBoxY, imgBoxSize, imgBoxSize);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = winnerOpt.imageUrl;
      });
    } catch {
      // Continue without image on error
    }
  }

  // Winner Banner Overlay at top of photo
  ctx.fillStyle = '#FF6B00';
  ctx.fillRect(imgBoxX, imgBoxY, imgBoxSize, 40);
  ctx.fillStyle = '#0D0B10';
  ctx.font = '900 20px "Archivo Black", sans-serif';
  ctx.fillText(result.isTie ? '★ CO-WINNER' : '👑 WINNER', imgBoxX + 16, imgBoxY + 28);

  // Winner Info Box Below Image
  ctx.fillStyle = '#0D0B10';
  ctx.fillRect(imgBoxX, imgBoxY + imgBoxSize - 70, imgBoxSize, 70);
  ctx.strokeStyle = '#F4EEDF';
  ctx.lineWidth = 2;
  ctx.strokeRect(imgBoxX, imgBoxY + imgBoxSize - 70, imgBoxSize, 70);

  ctx.fillStyle = '#F4EEDF';
  ctx.font = '900 22px "Archivo Black", sans-serif';
  const optTitle = (winnerOpt?.title ?? 'Winner').toUpperCase();
  ctx.fillText(optTitle.length > 20 ? optTitle.slice(0, 18) + '…' : optTitle, imgBoxX + 12, imgBoxY + imgBoxSize - 38);

  ctx.fillStyle = '#FF6B00';
  ctx.font = '700 16px "Space Mono", monospace';
  const metric = poll.settings?.enableSpecialVotes ? 'POINTS' : 'VOTES';
  ctx.fillText(`${winnerTally?.count ?? 0} ${metric} (${winnerTally?.percentage ?? 0}%)`, imgBoxX + 12, imgBoxY + imgBoxSize - 14);

  // 7. Right Side: Ranked Bars
  const rightX = 420;
  const barW = 730;
  const barH = 46;
  const startY = 145;

  ctx.fillStyle = '#8A8394';
  ctx.font = '700 14px "Space Mono", monospace';
  ctx.fillText('FULL RANKINGS', rightX, startY - 12);

  const topRanked = result.tallies.slice(0, 6);
  topRanked.forEach((tally, idx) => {
    const y = startY + idx * (barH + 10);
    const opt = poll.options.find((o) => o.id === tally.optionId);
    const isWin = result.winners.includes(tally.optionId);

    // Track
    ctx.fillStyle = '#1A1620';
    ctx.fillRect(rightX, y, barW, barH);
    ctx.strokeStyle = '#F4EEDF';
    ctx.lineWidth = 2;
    ctx.strokeRect(rightX, y, barW, barH);

    // Fill
    const fillW = Math.max(8, (tally.percentage / 100) * barW);
    ctx.fillStyle = isWin ? '#FF6B00' : '#F4EEDF';
    ctx.fillRect(rightX, y, fillW, barH);

    // Label inside
    ctx.fillStyle = '#0D0B10';
    ctx.font = '900 16px "Archivo Black", sans-serif';
    const rowLabel = `${isWin ? '★ ' : ''}${opt?.label ?? ''} — ${opt?.title ?? ''}`;
    ctx.fillText(rowLabel.length > 40 ? rowLabel.slice(0, 37) + '…' : rowLabel, rightX + 14, y + 28);

    // Count / Pct inside right
    ctx.fillStyle = '#0D0B10';
    ctx.font = '700 14px "Space Mono", monospace';
    const statText = `${tally.count}${poll.settings?.enableSpecialVotes ? ' PTS' : ''} (${tally.percentage}%)`;
    ctx.fillText(statText, rightX + barW - 110, y + 28);
  });

  // 8. Footer Strip
  const footerY = 580;
  ctx.strokeStyle = '#F4EEDF';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, footerY);
  ctx.lineTo(width - 40, footerY);
  ctx.stroke();

  ctx.fillStyle = '#8A8394';
  ctx.font = '700 14px "Space Mono", monospace';
  const totalMetric = poll.settings?.enableSpecialVotes ? `TOTAL POINTS: ${result.totalPoints || result.totalVotes}` : `TOTAL VOTES: ${result.totalVotes}`;
  ctx.fillText(totalMetric, 40, footerY + 26);
  ctx.fillText(`PARTICIPANTS: ${result.totalParticipants}`, 240, footerY + 26);
  ctx.fillText(`TURNOUT: ${result.turnoutPercentage}%`, 460, footerY + 26);
  ctx.fillText(`DATE: ${new Date().toLocaleDateString()}`, 660, footerY + 26);
  ctx.fillText(`POLL ID: ${poll.joinCode}`, 950, footerY + 26);

  // 9. Download PNG
  const link = document.createElement('a');
  link.download = `${poll.title.replace(/[^a-z0-9]/gi, '_')}_Result.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
