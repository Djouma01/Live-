export type TransferStatus = 'official' | 'rumor';
export type TransferClubSide = 'home' | 'away' | 'both';

export interface TransferItem {
  id: string;
  title: string;
  summary: string;
  status: TransferStatus;
  clubSide: TransferClubSide;
  clubName: string;
  publishedAt: string;
  source: string;
  url?: string;
  imageUrl?: string;
}

export interface MatchTransfersResponse {
  items: TransferItem[];
  sourceName: string;
}

const OFFICIAL_KEYWORDS = [
  'signs new',
  'signs for',
  'signed',
  'officially',
  'official',
  'joins ',
  'joined ',
  'completes move',
  'completed move',
  'complete signing',
  'completed signing',
  'unveiled',
  'confirmed',
  'extends contract',
  'new contract',
  'new deal',
  'contract extension',
  'loan move completed',
  'officialise',
  'a signé',
  'prolonge',
  'rejoint officiellement',
];

const TRANSFER_TOPIC_KEYWORDS = [
  'transfer',
  'transfers',
  'rumor',
  'rumour',
  'rumors',
  'rumours',
  'mercato',
  'sign ',
  'signs ',
  'signed',
  'signing',
  'loan',
  'bid ',
  'bids ',
  'linked',
  'target',
  'targets',
  'contract',
  'release clause',
  'free agent',
  'swap deal',
  'chase',
  'wants to sign',
  'interested in',
  'prêt',
  'recrue',
  'transfert',
];

export function classifyTransferStatus(text: string): TransferStatus {
  const lower = text.toLowerCase();
  // Explicit rumor markers always override generic words like "deal"
  if (
    lower.includes('rumor') ||
    lower.includes('rumour') ||
    lower.includes('transfer talk') ||
    lower.includes('rumeur') ||
    lower.includes('open to') ||
    lower.includes('linked') ||
    lower.includes('jockey for') ||
    lower.includes('chase') ||
    lower.includes('eyes ') ||
    lower.includes('could ')
  ) {
    return 'rumor';
  }
  for (const kw of OFFICIAL_KEYWORDS) {
    if (lower.includes(kw)) {
      return 'official';
    }
  }
  return 'rumor';
}

const NON_PLAYER_NOISE_PATTERNS = [
  'match ball',
  'star ball',
  'kit supplier',
  'shirt sponsor',
  'ball supplier',
  'apparel deal',
];

export function isTransferArticle(article: any): boolean {
  const headline = String(article?.headline || '');
  const description = String(article?.description || '');
  const text = `${headline} ${description}`.toLowerCase();

  // Exclude commercial equipment/ball/shirt-sponsor pieces unless clearly about player mercato
  const isCommercialPiece = NON_PLAYER_NOISE_PATTERNS.some((kw) => text.includes(kw));
  if (
    isCommercialPiece &&
    !text.includes('transfer') &&
    !text.includes('mercato') &&
    !text.includes('signing')
  ) {
    return false;
  }

  const cats = Array.isArray(article?.categories) ? article.categories : [];
  const hasTransferCategory = cats.some((c: any) => {
    const desc = String(c?.description || c?.slug || '').toLowerCase();
    return desc.includes('transfer') || desc.includes('mercato');
  });
  if (hasTransferCategory) return true;

  return TRANSFER_TOPIC_KEYWORDS.some((kw) => text.includes(kw));
}

function matchesClub(
  article: any,
  clubId: string,
  clubName: string,
  clubShortName: string
): boolean {
  const textHaystack = `${String(article?.headline || '')} ${String(
    article?.description || ''
  )}`.toLowerCase();

  const candidates = [clubName, clubShortName]
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 3);

  if (candidates.some((name) => textHaystack.includes(name))) {
    return true;
  }

  const cats = Array.isArray(article?.categories) ? article.categories : [];
  const teamCats = cats.filter((c: any) => c?.teamId !== undefined);
  // Only rely on teamId metadata when the article focuses on a few specific clubs (<= 3),
  // avoiding false matches on broad multi-club sponsor/commercial roundups.
  if (
    clubId &&
    teamCats.length <= 3 &&
    teamCats.some((c: any) => String(c.teamId) === String(clubId))
  ) {
    return true;
  }

  return false;
}

export function extractTransferItemsFromEspnArticles(
  articles: any[],
  opts: {
    homeId: string;
    homeName: string;
    homeShortName: string;
    awayId: string;
    awayName: string;
    awayShortName: string;
  }
): TransferItem[] {
  const seen = new Set<string>();
  const results: TransferItem[] = [];

  for (const a of articles) {
    const rawTitle = String(a?.headline || '').trim();
    if (!rawTitle) continue;
    // Clean duplicated ESPN prefix "Transfer rumors, news:Transfer rumors, news: ..."
    const title = rawTitle.replace(/^(Transfer rumors, news:\s*){2,}/i, 'Transferts : ');
    const dedupKey = String(a?.dataSourceIdentifier || a?.id || title).toLowerCase();
    if (seen.has(dedupKey) || seen.has(title.toLowerCase())) continue;

    if (!isTransferArticle(a)) continue;

    const hitHome = matchesClub(a, opts.homeId, opts.homeName, opts.homeShortName);
    const hitAway = matchesClub(a, opts.awayId, opts.awayName, opts.awayShortName);
    if (!hitHome && !hitAway) continue;

    seen.add(dedupKey);
    seen.add(title.toLowerCase());

    const clubSide: TransferClubSide = hitHome && hitAway ? 'both' : hitHome ? 'home' : 'away';
    const clubName =
      clubSide === 'both'
        ? `${opts.homeShortName} & ${opts.awayShortName}`
        : clubSide === 'home'
        ? opts.homeShortName
        : opts.awayShortName;

    const summary = String(a?.description || '').trim();
    const status = classifyTransferStatus(`${title} ${summary}`);
    const url = String(a?.links?.web?.href || a?.links?.mobile?.href || '').trim() || undefined;
    const imageUrl = String(a?.images?.[0]?.url || '').trim() || undefined;

    results.push({
      id: `espn-${String(a?.id || dedupKey)}`,
      title,
      summary,
      status,
      clubSide,
      clubName,
      publishedAt: String(a?.published || new Date().toISOString()),
      source: status === 'rumor' ? 'ESPN Transfer Talk' : 'ESPN Soccer',
      url,
      imageUrl,
    });
  }

  return results;
}

export function parseEspnTransactionsToTransfers(
  transactions: any[],
  opts: {
    homeId: string;
    homeName: string;
    homeShortName: string;
    awayId: string;
    awayName: string;
    awayShortName: string;
  }
): TransferItem[] {
  const results: TransferItem[] = [];

  for (let i = 0; i < transactions.length; i += 1) {
    const tx = transactions[i];
    const teamId = String(tx?.team?.id || '');
    const teamName = String(tx?.team?.displayName || tx?.team?.name || '');
    const desc = String(tx?.description || tx?.text || '').trim();
    if (!desc) continue;

    const hitHome =
      (opts.homeId && teamId === opts.homeId) ||
      teamName.toLowerCase().includes(opts.homeShortName.toLowerCase()) ||
      desc.toLowerCase().includes(opts.homeShortName.toLowerCase());
    const hitAway =
      (opts.awayId && teamId === opts.awayId) ||
      teamName.toLowerCase().includes(opts.awayShortName.toLowerCase()) ||
      desc.toLowerCase().includes(opts.awayShortName.toLowerCase());

    if (!hitHome && !hitAway) continue;

    const clubSide: TransferClubSide = hitHome && hitAway ? 'both' : hitHome ? 'home' : 'away';
    results.push({
      id: `tx-${String(tx?.id || i)}`,
      title: String(tx?.player?.displayName || tx?.athlete?.displayName || teamName || 'Mouvement officiel'),
      summary: desc,
      status: 'official',
      clubSide,
      clubName:
        clubSide === 'both'
          ? `${opts.homeShortName} & ${opts.awayShortName}`
          : clubSide === 'home'
          ? opts.homeShortName
          : opts.awayShortName,
      publishedAt: String(tx?.date || new Date().toISOString()),
      source: 'ESPN Transactions',
    });
  }

  return results;
}

export function mergeAndSortTransfers(items: TransferItem[]): TransferItem[] {
  const seenTitles = new Set<string>();
  const unique: TransferItem[] = [];
  for (const item of items) {
    const k = item.title.toLowerCase();
    if (seenTitles.has(k)) continue;
    seenTitles.add(k);
    unique.push(item);
  }
  unique.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return unique.slice(0, 16);
}
