import React, { useMemo, useState } from 'react';
import { Globe, Trophy, Star, ChevronRight, Layers, ShieldAlert } from 'lucide-react';
import {
  groupCompetitionsByCountryAndDivision,
  type CompetitionInfo,
  type CountryGroupInfo,
} from '../lib/football';

interface CompetitionsHierarchyViewProps {
  mode: 'countries' | 'competitions';
  competitions: CompetitionInfo[];
  countries: CountryGroupInfo[];
  favoriteCompetitionIds: string[];
  sportradarConfigured: boolean;
  initialCountry?: string;
  onSelectCountryToCompetitions: (country: string) => void;
  onSelectCompetition: (competition: CompetitionInfo) => void;
  onToggleFavoriteCompetition: (competitionId: string) => void;
}

const REGION_ORDER: { id: string; label: string }[] = [
  { id: 'europe', label: 'Europe (Championnats, divisions inférieures & Coupes)' },
  { id: 'middle_east', label: 'Arabie saoudite & Moyen-Orient' },
  { id: 'americas', label: 'États-Unis & Brésil (Amériques)' },
  { id: 'africa', label: 'Afrique' },
  { id: 'international', label: 'Compétitions internationales & Coupes du monde' },
];

export const CompetitionsHierarchyView: React.FC<CompetitionsHierarchyViewProps> = ({
  mode,
  competitions,
  countries,
  favoriteCompetitionIds,
  sportradarConfigured,
  initialCountry = '',
  onSelectCountryToCompetitions,
  onSelectCompetition,
  onToggleFavoriteCompetition,
}) => {
  const availableCompetitions = useMemo(
    () => competitions.filter((c) => c.available),
    [competitions]
  );

  const groupedCountries = useMemo(() => {
    if (countries.length > 0) return countries;
    return groupCompetitionsByCountryAndDivision(competitions);
  }, [countries, competitions]);

  const [selectedCountry, setSelectedCountry] = useState<string>(
    initialCountry || groupedCountries[0]?.country || ''
  );
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [selectedDivisionFilter, setSelectedDivisionFilter] = useState<string>('all');

  const effectiveCountry = useMemo(() => {
    if (initialCountry && groupedCountries.some((g) => g.country === initialCountry)) {
      return initialCountry;
    }
    if (selectedCountry && groupedCountries.some((g) => g.country === selectedCountry)) {
      return selectedCountry;
    }
    return groupedCountries[0]?.country || '';
  }, [initialCountry, selectedCountry, groupedCountries]);

  const countryCompetitions = useMemo(() => {
    const group = groupedCountries.find((g) => g.country === effectiveCountry);
    return group?.competitions || [];
  }, [groupedCountries, effectiveCountry]);

  const divisionLabels = useMemo(() => {
    const set = new Set<string>();
    countryCompetitions.forEach((c) => {
      if (c.divisionLabel) set.add(c.divisionLabel);
    });
    return Array.from(set);
  }, [countryCompetitions]);

  const filteredCountryComps = useMemo(() => {
    return countryCompetitions.filter((c) => {
      if (selectedDivisionFilter !== 'all' && c.divisionLabel !== selectedDivisionFilter) {
        return false;
      }
      return true;
    });
  }, [countryCompetitions, selectedDivisionFilter]);

  const activePickedComp = useMemo(() => {
    return (
      filteredCountryComps.find((c) => c.id === selectedCompetitionId) ||
      filteredCountryComps[0] ||
      null
    );
  }, [filteredCountryComps, selectedCompetitionId]);

  if (mode === 'countries') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Pays &amp; Couverture Internationale
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
              Sélectionnez un pays pour explorer ses championnats, divisions et coupes nationales.
            </p>
          </div>
          <span className="text-xs font-mono text-zinc-400 tabular-nums">
            {groupedCountries.length} pays/zones · {availableCompetitions.length} compétitions actives
          </span>
        </div>

        {!sportradarConfigured && (
          <div className="p-4 rounded-2xl bg-[#12121A] border border-violet-500/25 flex items-start gap-3 text-xs text-zinc-300">
            <ShieldAlert className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Extension Sportradar Soccer v4 prête</p>
              <p className="text-zinc-400 mt-0.5">
                {availableCompetitions.length} compétitions sont actives immédiatement. Ajoutez{' '}
                <code className="text-violet-300">SPORTRADAR_API_KEY</code> dans les secrets serveur &amp; Firebase Secret Manager pour débloquer automatiquement toutes les divisions inférieures mondiales (Série C/D Brésil, divisions 3+ européennes, Saudi First Division, USL, First League russe...).
              </p>
            </div>
          </div>
        )}

        <div className="space-y-8">
          {REGION_ORDER.map((reg) => {
            const regionCountries = groupedCountries.filter((g) => g.region === reg.id);
            if (regionCountries.length === 0) return null;
            return (
              <section key={reg.id} className="space-y-3">
                <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-violet-400" />
                  {reg.label}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {regionCountries.map((cg) => (
                    <button
                      key={cg.country}
                      type="button"
                      onClick={() => onSelectCountryToCompetitions(cg.country)}
                      className="rounded-2xl bg-[#12121A] border border-white/8 hover:border-violet-500/45 p-4 text-left flex items-center justify-between gap-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    >
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-white truncate">{cg.country}</p>
                        <p className="text-xs text-zinc-400 mt-0.5 truncate">
                          {cg.competitions.length}{' '}
                          {cg.competitions.length > 1 ? 'compétitions / divisions' : 'compétition'}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          Championnats &amp; Divisions
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
          Sélectionnez un pays, puis une compétition et sa division pour consulter le classement et les matchs.
        </p>
      </div>

      {/* Sélecteur 3 étapes : 1. Pays -> 2. Compétition -> 3. Division */}
      <section
        aria-label="Sélecteur Pays, Compétition et Division"
        className="rounded-2xl bg-[#12121A] border border-white/8 p-4 space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label htmlFor="select-country-step" className="block text-xs font-medium text-zinc-400 mb-1.5">
              1. Pays / Zone
            </label>
            <select
              id="select-country-step"
              value={effectiveCountry}
              onChange={(e) => {
                setSelectedCountry(e.target.value);
                setSelectedDivisionFilter('all');
                setSelectedCompetitionId('');
              }}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#09090E] border border-white/10 text-sm text-white focus:outline-none focus:border-violet-500"
            >
              {groupedCountries.map((cg) => (
                <option key={cg.country} value={cg.country}>
                  {cg.country} ({cg.competitions.length})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="select-division-step" className="block text-xs font-medium text-zinc-400 mb-1.5">
              2. Division / Type
            </label>
            <select
              id="select-division-step"
              value={selectedDivisionFilter}
              onChange={(e) => {
                setSelectedDivisionFilter(e.target.value);
                setSelectedCompetitionId('');
              }}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#09090E] border border-white/10 text-sm text-white focus:outline-none focus:border-violet-500"
            >
              <option value="all">Toutes les divisions ({countryCompetitions.length})</option>
              {divisionLabels.map((div) => (
                <option key={div} value={div}>
                  {div}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="select-competition-step" className="block text-xs font-medium text-zinc-400 mb-1.5">
              3. Compétition
            </label>
            <div className="flex gap-2">
              <select
                id="select-competition-step"
                value={activePickedComp?.id || ''}
                onChange={(e) => setSelectedCompetitionId(e.target.value)}
                className="flex-1 min-w-0 min-h-[44px] px-3.5 rounded-xl bg-[#09090E] border border-white/10 text-sm text-white focus:outline-none focus:border-violet-500"
              >
                {filteredCountryComps.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.name}
                  </option>
                ))}
              </select>
              {activePickedComp && (
                <button
                  type="button"
                  onClick={() => onSelectCompetition(activePickedComp)}
                  className="min-h-[44px] px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors"
                >
                  Ouvrir
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Catalogue complet filtré pour le pays sélectionné */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
          <Layers className="w-4 h-4 text-violet-400" />
          Compétitions disponibles — {effectiveCountry} ({filteredCountryComps.length})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredCountryComps.map((comp) => {
            const isFav = favoriteCompetitionIds.includes(comp.id);
            return (
              <div
                key={comp.id}
                className="rounded-2xl bg-[#12121A] border border-white/8 hover:border-violet-500/40 p-4 flex items-center justify-between gap-3 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onSelectCompetition(comp)}
                  className="flex-1 text-left flex items-center gap-3 min-w-0 focus-visible:outline-none"
                >
                  {comp.logo ? (
                    <img
                      src={comp.logo}
                      alt={comp.name}
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 object-contain rounded-lg bg-white/5 p-1 shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                      <Trophy className="w-4 h-4 text-violet-300" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{comp.name}</p>
                    <p className="text-xs text-zinc-400 truncate">
                      {comp.country} · {comp.divisionLabel || 'Compétition officielle'}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleFavoriteCompetition(comp.id)}
                  aria-label={isFav ? `Retirer ${comp.name} des favoris` : `Suivre ${comp.name}`}
                  aria-pressed={isFav}
                  className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors ${
                    isFav ? 'text-violet-400' : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  <Star className={`w-4 h-4 ${isFav ? 'fill-violet-400' : ''}`} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Toutes les compétitions par grande région */}
      <section className="space-y-3 pt-2 border-t border-white/8">
        <h2 className="text-sm font-semibold text-zinc-300">
          Catalogue complet ({availableCompetitions.length} compétitions actives)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {availableCompetitions.map((comp) => {
            const isFav = favoriteCompetitionIds.includes(comp.id);
            return (
              <div
                key={`all-${comp.id}`}
                className="rounded-2xl bg-[#12121A] border border-white/8 hover:border-violet-500/35 p-3.5 flex items-center justify-between gap-2 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onSelectCompetition(comp)}
                  className="flex-1 text-left min-w-0"
                >
                  <p className="text-sm font-semibold text-white truncate">{comp.name}</p>
                  <p className="text-xs text-zinc-400 truncate">
                    {comp.country} {comp.divisionLabel ? `· ${comp.divisionLabel}` : ''}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleFavoriteCompetition(comp.id)}
                  aria-label={isFav ? `Retirer ${comp.name} des favoris` : `Suivre ${comp.name}`}
                  className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl ${
                    isFav ? 'text-violet-400' : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  <Star className={`w-4 h-4 ${isFav ? 'fill-violet-400' : ''}`} />
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
