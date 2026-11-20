import { BookingQuoteResult, BundleAllocation, Cinema } from '../types.js';

/**
 * Given a cinema (with 1–10 bundle sizes, each 1–500 seats) and a groupSize (1–10,000),
 * computes the fewest bundles whose seats add up to EXACTLY `groupSize`,
 * and how many of each bundle size to buy.
 *
 * Uses Bottom-Up Dynamic Programming written from scratch:
 * - dp[s] = fewest number of bundles required to get exactly `s` seats
 * - choice[s] = bundle size chosen to reach `s` seats optimally
 * - Iterates bundle sizes in descending order so larger bundles are preferred on ties.
 */
export function computeBookingQuote(
  cinema: Cinema,
  groupSize: number
): BookingQuoteResult {
  if (!Number.isInteger(groupSize) || groupSize < 1 || groupSize > 10000) {
    throw new Error('groupSize must be an integer between 1 and 10,000');
  }

  // Deduplicate and sort bundle sizes descending
  const sortedSizes = Array.from(new Set(cinema.bundleSizes)).sort((a, b) => b - a);

  const INF = groupSize + 1;
  const dp = new Int32Array(groupSize + 1).fill(INF);
  const choice = new Int32Array(groupSize + 1).fill(-1);

  dp[0] = 0;

  for (let s = 1; s <= groupSize; s++) {
    for (let i = 0; i < sortedSizes.length; i++) {
      const bundleSize = sortedSizes[i];
      if (s >= bundleSize && dp[s - bundleSize] + 1 < dp[s]) {
        dp[s] = dp[s - bundleSize] + 1;
        choice[s] = bundleSize;
      }
    }
  }

  if (dp[groupSize] >= INF) {
    return {
      cinemaId: cinema.id,
      cinemaName: cinema.name,
      bundleSizes: sortedSizes,
      groupSize,
      possible: false,
      totalBundles: null,
      bundles: [],
      breakdown: {},
      formatted: 'Not possible',
    };
  }

  // Reconstruct bundle counts by backtracking from groupSize to 0
  const countsMap = new Map<number, number>();
  let remaining = groupSize;
  while (remaining > 0) {
    const chosenSize = choice[remaining];
    if (chosenSize <= 0) {
      break;
    }
    countsMap.set(chosenSize, (countsMap.get(chosenSize) ?? 0) + 1);
    remaining -= chosenSize;
  }

  // Order breakdown by bundle size descending (matching assessment table format)
  const bundles: BundleAllocation[] = [];
  const breakdown: Record<number, number> = {};

  for (const size of sortedSizes) {
    const count = countsMap.get(size);
    if (count && count > 0) {
      bundles.push({
        bundleSize: size,
        count,
        totalSeats: size * count,
      });
      breakdown[size] = count;
    }
  }

  const totalBundles = dp[groupSize];
  const bundleLabel = totalBundles === 1 ? '1 bundle' : `${totalBundles} bundles`;
  const parts = bundles.map((b) => `${b.bundleSize} × ${b.count}`).join(', ');
  const formatted = `${bundleLabel}: ${parts}`;

  return {
    cinemaId: cinema.id,
    cinemaName: cinema.name,
    bundleSizes: sortedSizes,
    groupSize,
    possible: true,
    totalBundles,
    bundles,
    breakdown,
    formatted,
  };
}
