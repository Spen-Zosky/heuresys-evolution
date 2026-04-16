-- Migration: 079_news_articles_seed.sql
-- Description: Seed news articles for each tenant with industry-specific content
-- Date: 2025-12-30
-- Epic: Comprehensive Data Population

-- ============================================================================
-- RTL BANK - BANKING/FINANCE NEWS
-- ============================================================================

INSERT INTO news_articles (tenant_id, category_id, author_id, title, slug, excerpt, content, status, is_featured, is_pinned, published_at, views_count)
SELECT
    t.id,
    (SELECT nc.id FROM news_categories nc WHERE nc.tenant_id = t.id AND nc.slug = art.category_slug),
    (SELECT u.id FROM users u WHERE u.username LIKE 'rtl-bank.%' LIMIT 1),
    art.title,
    art.slug,
    art.excerpt,
    art.content,
    'published',
    art.is_featured,
    art.is_pinned,
    NOW() - (art.days_ago || ' days')::interval,
    floor(random() * 500)::int + 50
FROM tenants t
CROSS JOIN (VALUES
    ('company-updates', 'Risultati Q3 2024: crescita sostenuta del margine', 'risultati-q3-2024-crescita', 'RTL Bank chiude il terzo trimestre con risultati superiori alle attese', E'# Risultati Q3 2024\n\nSiamo lieti di comunicare che RTL Bank ha chiuso il terzo trimestre 2024 con risultati eccezionali.\n\n## Highlights\n- **Margine di intermediazione**: +12% YoY\n- **Utile netto**: EUR 45M (+8%)\n- **NPL ratio**: sceso al 2.8%\n\nRingraziamo tutti i colleghi per impegno quotidiano.', true, true, 15),
    ('company-updates', 'Nuova filiale a Torino: espansione territoriale', 'nuova-filiale-torino-2025', 'Apertura prevista per gennaio 2025 nel centro storico', E'# Nuova Filiale Torino Centro\n\nSiamo entusiasti di annunciare apertura della nuova filiale nel cuore di Torino.\n\n## Dettagli\n- **Location**: Via Roma 145\n- **Apertura**: 15 gennaio 2025\n- **Team**: 12 professionisti', true, false, 30),
    ('company-updates', 'Partnership strategica con Fintech per pagamenti', 'partnership-fintech-pagamenti', 'Accordo per integrazione soluzioni di pagamento innovative', E'# Partnership Strategica\n\nRTL Bank annuncia una partnership strategica per accelerare innovazione nei pagamenti digitali.\n\n## Obiettivi\n- Instant payments 24/7\n- Wallet digitale integrato\n- Buy Now Pay Later per clienti retail', false, false, 45),
    ('company-updates', 'Certificazione ISO 27001 rinnovata', 'iso-27001-rinnovo-2024', 'Confermati i piu alti standard di sicurezza informatica', E'# ISO 27001 Rinnovata\n\nSiamo orgogliosi di comunicare il rinnovo della certificazione ISO 27001 per la sicurezza delle informazioni.\n\nQuesto risultato conferma il nostro impegno nella protezione dei dati dei clienti.', false, false, 60),
    ('hr-benefits', 'Nuovo piano welfare 2025: piu flessibilita', 'piano-welfare-2025', 'Ampliamento dei servizi di welfare aziendale', E'# Piano Welfare 2025\n\nIl nuovo piano welfare introduce importanti novita:\n\n## Principali benefit\n- **Flexible benefit**: EUR 2.000/anno\n- **Smart working**: fino a 3 giorni/settimana\n- **Assicurazione sanitaria**: estesa ai familiari', true, false, 25),
    ('hr-benefits', 'Aggiornamento policy smart working', 'policy-smart-working-2025', 'Nuove linee guida per il lavoro agile dal 2025', E'# Smart Working Policy 2025\n\nA partire dal 1 gennaio 2025 entrano in vigore le nuove linee guida:\n\n- Massimo 3 giorni a settimana\n- Accordo individuale con il manager\n- Buono pasto anche in smart working', false, false, 40),
    ('hr-benefits', 'Programma Employee Assistance attivato', 'employee-assistance-program', 'Servizio di counseling psicologico per tutti i dipendenti', E'# Employee Assistance Program\n\nLanciamo il nuovo servizio di supporto psicologico:\n\n- **6 sessioni gratuite**/anno\n- Consulenza telefonica 24/7\n- Completa riservatezza', false, false, 55),
    ('events', 'Festa di Natale 2024: tutti al Palazzo dei Congressi', 'festa-natale-2024', 'Evento aziendale il 20 dicembre', E'# Festa di Natale 2024\n\nSave the date!\n\n**Data**: 20 dicembre 2024\n**Luogo**: Palazzo dei Congressi, Milano\n**Ora**: 19:00\n\nCena di gala, musica dal vivo e tante sorprese!', true, true, 10),
    ('events', 'Town Hall Q4: risultati e obiettivi 2025', 'town-hall-q4-2024', 'Incontro con il management il 15 gennaio', E'# Town Hall Q4\n\nIl CEO e il management team presenteranno:\n\n- Risultati 2024\n- Strategia 2025\n- Q&A session\n\n**Data**: 15 gennaio 2025, ore 16:00', false, false, 5),
    ('events', 'Team Building: Challenge tra filiali', 'team-building-challenge-2025', 'Competizione sportiva e ludica tra le diverse sedi', E'# Inter-Branch Challenge 2025\n\nTorna la sfida piu attesa dell anno!\n\n## Discipline\n- Calcetto\n- Pallavolo\n- Quiz a squadre\n\n**Quando**: 8 febbraio 2025', false, false, 35),
    ('events', 'Academy: corso Leadership per nuovi manager', 'academy-leadership-2025', 'Programma formativo di 5 giornate', E'# Leadership Development Program\n\nProgramma intensivo per futuri leader:\n\n## Moduli\n1. Self-leadership e intelligenza emotiva\n2. Gestione del team\n3. Decision making\n\n**Durata**: 5 giornate (febbraio-marzo 2025)', false, false, 50),
    ('events', 'Certificazione MiFID II: sessione formativa', 'mifid-ii-formazione-2025', 'Aggiornamento normativo per consulenti', E'# Formazione MiFID II\n\nSessione obbligatoria di aggiornamento:\n\n- **Data**: 22-23 gennaio 2025\n- **Durata**: 16 ore\n- **Certificazione**: Attestato valido 12 mesi', false, false, 28)
) AS art(category_slug, title, slug, excerpt, content, is_featured, is_pinned, days_ago)
WHERE t.code = 'rtl-bank'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SMARTFOOD - FOOD INDUSTRY NEWS
-- ============================================================================

INSERT INTO news_articles (tenant_id, category_id, author_id, title, slug, excerpt, content, status, is_featured, is_pinned, published_at, views_count)
SELECT
    t.id,
    (SELECT nc.id FROM news_categories nc WHERE nc.tenant_id = t.id AND nc.slug = art.category_slug),
    (SELECT u.id FROM users u WHERE u.username LIKE 'smartfood.%' LIMIT 1),
    art.title,
    art.slug,
    art.excerpt,
    art.content,
    'published',
    art.is_featured,
    art.is_pinned,
    NOW() - (art.days_ago || ' days')::interval,
    floor(random() * 300)::int + 30
FROM tenants t
CROSS JOIN (VALUES
    ('company-updates', 'Certificazione BRC rinnovata con punteggio A+', 'brc-certificazione-a-plus', 'Confermati i piu alti standard di qualita e sicurezza alimentare', E'# BRC A+ Certification\n\nSmartFood ottiene il massimo punteggio nella certificazione BRC Food Safety:\n\n- **Punteggio**: A+ (massimo)\n- **Non conformita maggiori**: 0\n\nQuesto risultato premia impegno di tutto il team Quality.', true, true, 18),
    ('company-updates', 'Lancio linea biologica NaturalChoice', 'lancio-naturalchoice-bio', 'Nuova gamma di prodotti 100% biologici certificati', E'# NaturalChoice Bio\n\nSiamo entusiasti di presentare la nuova linea biologica:\n\n## Prodotti\n- Pasta integrale bio\n- Sughi vegetali bio\n- Snack salutari bio\n\nTutti i prodotti sono certificati ICEA.', true, false, 22),
    ('company-updates', 'Nuovo stabilimento Veneto: produzione raddoppiata', 'stabilimento-veneto-apertura', 'Investimento da EUR 15M per la nuova unita produttiva', E'# Nuovo Stabilimento Veneto\n\nAnnunciamo apertura del nuovo stabilimento:\n\n- **Location**: Verona\n- **Capacita**: +50% produzione\n- **Posti di lavoro**: 45 nuove assunzioni', false, false, 40),
    ('company-updates', 'Zero sprechi: -30% food waste nel 2024', 'zero-sprechi-risultati-2024', 'Obiettivo sostenibilita superato grazie all impegno di tutti', E'# Zero Sprechi 2024\n\nRisultati del programma di riduzione sprechi:\n\n- **Food waste**: -30% vs 2023\n- **Packaging riciclato**: 85%\n- **Energia rinnovabile**: 60%', false, false, 55),
    ('hr-benefits', 'Buoni pasto aumentati a EUR 8 dal 2025', 'buoni-pasto-aumento-2025', 'Incremento del valore dei ticket restaurant', E'# Buoni Pasto 2025\n\nDal 1 gennaio 2025:\n\n- Valore buono pasto: **EUR 8** (da EUR 7)\n- Erogazione digitale\n- Spendibili anche in smart working', true, false, 12),
    ('hr-benefits', 'Convenzione mensa aziendale rinnovata', 'convenzione-mensa-2025', 'Nuovi menu piu salutari e sostenibili', E'# Mensa Aziendale 2025\n\nNovita per la mensa:\n\n- Menu vegetariano/vegano ampliato\n- Ingredienti km0\n- Sconto 20% per dipendenti', false, false, 35),
    ('events', 'Food Innovation Day: workshop e degustazioni', 'food-innovation-day-2025', 'Evento interno dedicato all innovazione di prodotto', E'# Food Innovation Day\n\nGiornata dedicata all innovazione:\n\n## Programma\n- 10:00 - Trend alimentari 2025\n- 12:00 - Workshop R&D\n- 14:00 - Degustazione nuovi prototipi\n\n**Data**: 25 gennaio 2025', true, false, 8),
    ('events', 'Festa del Raccolto: evento famiglia', 'festa-raccolto-2024', 'Giornata di festa per dipendenti e famiglie', E'# Festa del Raccolto 2024\n\nEvento per tutte le famiglie!\n\n- Visita guidata allo stabilimento\n- Laboratori per bambini\n- Degustazione prodotti\n\n**Data**: 5 ottobre 2024', false, false, 85),
    ('events', 'Corso HACCP: aggiornamento obbligatorio', 'corso-haccp-aggiornamento-2025', 'Formazione per tutto il personale di produzione', E'# Aggiornamento HACCP\n\nSessioni formative obbligatorie:\n\n- **Date**: 15-16-17 gennaio 2025\n- **Durata**: 4 ore\n- **Sede**: Aula formazione', false, false, 20),
    ('events', 'Team Building: cooking challenge', 'team-cooking-challenge-2025', 'Sfida culinaria tra i reparti aziendali', E'# Cooking Challenge 2025\n\nSfida ai fornelli tra team!\n\n## Regole\n- Squadre da 4 persone\n- 90 minuti per preparare un piatto\n\n**Data**: 15 febbraio 2025', false, false, 32)
) AS art(category_slug, title, slug, excerpt, content, is_featured, is_pinned, days_ago)
WHERE t.code = 'smartfood'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ECONOVA - SUSTAINABILITY NEWS
-- ============================================================================

INSERT INTO news_articles (tenant_id, category_id, author_id, title, slug, excerpt, content, status, is_featured, is_pinned, published_at, views_count)
SELECT
    t.id,
    (SELECT nc.id FROM news_categories nc WHERE nc.tenant_id = t.id AND nc.slug = art.category_slug),
    (SELECT u.id FROM users u WHERE u.username LIKE 'econova.%' LIMIT 1),
    art.title,
    art.slug,
    art.excerpt,
    art.content,
    'published',
    art.is_featured,
    art.is_pinned,
    NOW() - (art.days_ago || ' days')::interval,
    floor(random() * 200)::int + 20
FROM tenants t
CROSS JOIN (VALUES
    ('company-updates', 'EcoNova tra le top 10 B Corp italiane', 'top-10-bcorp-italia', 'Riconoscimento per impatto positivo su ambiente e comunita', E'# Top 10 B Corp Italia\n\nSiamo entrati nella classifica delle migliori B Corp italiane!\n\n## Score\n- **B Impact Score**: 112.5 (media: 50.9)\n- **Environment**: 33.8\n\nUn traguardo che premia il nostro impegno.', true, true, 12),
    ('company-updates', 'Partnership con Universita Bocconi per ricerca ESG', 'partnership-bocconi-esg', 'Collaborazione accademica per sviluppo di metodologie innovative', E'# Partnership Bocconi\n\nAvviamo un progetto di ricerca congiunto:\n\n## Focus\n- Metriche ESG settoriali\n- Benchmark europei\n- Pubblicazioni scientifiche\n\n**Durata**: 24 mesi', true, false, 25),
    ('company-updates', 'Nuovo ufficio Milano: spazio 100% green', 'nuovo-ufficio-milano-green', 'Sede certificata LEED Platinum con zero emissioni operative', E'# Nuova Sede Milano\n\nCi trasferiamo in un edificio all avanguardia:\n\n- **Certificazione**: LEED Platinum\n- **Energia**: 100% rinnovabile\n- **Mobilita**: bike sharing e ricarica EV\n\n**Inaugurazione**: Febbraio 2025', false, false, 38),
    ('company-updates', 'Carbon footprint aziendale: -45% in 3 anni', 'carbon-footprint-riduzione', 'Risultati del piano di decarbonizzazione', E'# Carbon Footprint Report\n\nRisultati del triennio 2022-2024:\n\n- 2022: 245 tCO2e\n- 2023: 178 tCO2e (-27%)\n- 2024: 134 tCO2e (-45%)\n\n**Target 2026**: Net Zero', false, false, 50),
    ('hr-benefits', 'Mobilita sostenibile: incentivi bici e EV', 'incentivi-mobilita-sostenibile', 'Contributi per chi sceglie mezzi a basso impatto', E'# Mobilita Sostenibile\n\nNuovi incentivi dal 2025:\n\n- **Bici/E-bike**: EUR 500/anno\n- **Auto elettrica**: EUR 150/mese ricarica\n- **Abbonamento TPL**: rimborso 50%', true, false, 18),
    ('hr-benefits', 'Formazione continua: budget EUR 3.000/anno', 'formazione-budget-2025', 'Investimento nella crescita professionale del team', E'# Budget Formazione 2025\n\nOgni collaboratore dispone di:\n\n- **EUR 3.000/anno** per formazione\n- Corsi, certificazioni, conferenze\n- Tempo dedicato: 5 giorni/anno', false, false, 30),
    ('events', 'EcoDay 2025: workshop su economia circolare', 'ecoday-2025-economia-circolare', 'Evento formativo interno sulla circolarita', E'# EcoDay 2025\n\nGiornata dedicata economia circolare:\n\n## Agenda\n- 09:00 - Keynote: Circular Economy Trends\n- 11:00 - Case study clienti\n- 14:00 - Workshop pratici\n\n**Data**: 30 gennaio 2025', true, false, 6),
    ('events', 'COP29: il nostro contributo', 'cop29-contributo-econova', 'Partecipazione alla conferenza sul clima', E'# COP29 - Baku\n\nEcoNova presente alla COP29:\n\n- Side event su carbon pricing\n- Pubblicazione white paper\n- Networking con policy maker', false, false, 45),
    ('events', 'Green Friday: zero email, 100% outdoor', 'green-friday-outdoor', 'Giornata di team building nella natura', E'# Green Friday\n\nGiornata speciale all aperto:\n\n- Escursione guidata\n- Piantumazione alberi\n- Digital detox\n\n**Data**: 14 febbraio 2025', false, false, 22)
) AS art(category_slug, title, slug, excerpt, content, is_featured, is_pinned, days_ago)
WHERE t.code = 'econova'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ADD NEWS READS (Engagement tracking)
-- ============================================================================

INSERT INTO news_reads (tenant_id, article_id, user_id, read_at)
SELECT
    na.tenant_id,
    na.id,
    e.user_id,
    na.published_at + (random() * (NOW() - na.published_at))
FROM news_articles na
JOIN employees e ON e.tenant_id = na.tenant_id AND e.user_id IS NOT NULL
WHERE na.status = 'published'
AND random() < 0.4
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_articles INTEGER;
    v_reads INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_articles FROM news_articles;
    SELECT COUNT(*) INTO v_reads FROM news_reads;

    RAISE NOTICE '=== Migration 079 Verification ===';
    RAISE NOTICE 'Total articles: %', v_articles;
    RAISE NOTICE 'Total reads: %', v_reads;
END $$;
