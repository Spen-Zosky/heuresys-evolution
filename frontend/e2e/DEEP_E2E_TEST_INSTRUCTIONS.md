# ISTRUZIONI TEST E2E COMPLETI — HEURESYS FRONTEND

**Autore:** Claude (dopo fallimento sessione 2026-03-04/05)
**Scopo:** Istruzioni per un DEEP TESTER che deve verificare TUTTO funziona realmente
**Regola:** Se fallisci anche UN SOLO test, SEI FUORI.

---

## PREMESSA FONDAMENTALE

I test precedenti verificavano SOLO che le pagine si aprissero senza crash JavaScript. Questo NON E' SUFFICIENTE. Una pagina che mostra "Nessun dato trovato" quando ci sono dati nel DB e' una pagina ROTTA.

**CRITERIO DI SUCCESSO:** Ogni pagina deve mostrare DATI REALI, CORRETTI, FORMATTATI CORRETTAMENTE.

**PAGINE TOTALI:** 81 page.tsx nel progetto. TUTTE devono essere testate. Nessuna esclusa.

**UTENTI PER I TEST:**
- `rtl-admin` / `Admin2026` — Tenant RTL Bank (156 dipendenti, dati ricchi) — per test Admin
- `sysadmin` / `Admin2026` — Tenant Heuresys (3 dipendenti) — per test Platform
- Un utente USER di RTL Bank — per test Portal

---

## FASE 0: PREREQUISITI

### 0.1 Verifica Backend — OGNI endpoint
PRIMA di toccare il frontend, verifica che TUTTE le API funzionino.
Login come `rtl-admin` e testa:

```bash
TOKEN=$(curl -s http://localhost:8012/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"rtl-admin","password":"Admin2026"}' | jq -r '.data.token')

# DEVE restituire > 0 per OGNUNO
curl -s http://localhost:8012/api/v1/employees -H "Authorization: Bearer $TOKEN" | jq '.data.items | length'
curl -s http://localhost:8012/api/v1/departments -H "Authorization: Bearer $TOKEN" | jq '.data.items | length'
curl -s http://localhost:8012/api/v1/org-units -H "Authorization: Bearer $TOKEN" | jq '.data.items | length'
curl -s http://localhost:8012/api/v1/locations -H "Authorization: Bearer $TOKEN" | jq '.data.items | length'
curl -s http://localhost:8012/api/v1/cost-centers -H "Authorization: Bearer $TOKEN" | jq '.data.items | length'
curl -s http://localhost:8012/api/v1/goals -H "Authorization: Bearer $TOKEN" | jq '.data.items | length'
curl -s http://localhost:8012/api/v1/performance-reviews -H "Authorization: Bearer $TOKEN" | jq '.data.items | length'
curl -s http://localhost:8012/api/v1/check-ins -H "Authorization: Bearer $TOKEN" | jq '.data.items | length'
curl -s http://localhost:8012/api/v1/courses -H "Authorization: Bearer $TOKEN" | jq '.data.items | length'
curl -s http://localhost:8012/api/v1/skills -H "Authorization: Bearer $TOKEN" | jq '.data.items | length'
curl -s http://localhost:8012/api/v1/certifications -H "Authorization: Bearer $TOKEN" | jq '.data.items | length'
curl -s http://localhost:8012/api/v1/feedback -H "Authorization: Bearer $TOKEN" | jq '.data.items | length'
curl -s http://localhost:8012/api/v1/candidates -H "Authorization: Bearer $TOKEN" | jq '.data.items | length'
curl -s http://localhost:8012/api/v1/job-postings -H "Authorization: Bearer $TOKEN" | jq '.data.items | length'
curl -s http://localhost:8012/api/v1/users -H "Authorization: Bearer $TOKEN" | jq '.data.items | length'
curl -s http://localhost:8012/api/v1/enrollments -H "Authorization: Bearer $TOKEN" | jq '.data.items | length'
curl -s http://localhost:8012/api/v1/dashboard/overview -H "Authorization: Bearer $TOKEN" | jq '.data'
curl -s http://localhost:8012/api/v1/analytics/overview -H "Authorization: Bearer $TOKEN" | jq '.data'
```

**SE ANCHE UN SOLO ENDPOINT RESTITUISCE 0 O ERRORE, FERMA TUTTO E FIXA IL BACKEND PRIMA.**

### 0.2 Recupera ID Reali dal DB
Servono per le pagine `[id]`:

```sql
-- Salva questi ID per i test
SELECT id FROM employees WHERE tenant_id = '0c54b84a-...' LIMIT 3;
SELECT id FROM departments WHERE tenant_id = '0c54b84a-...' LIMIT 3;
SELECT id FROM org_units WHERE tenant_id = '0c54b84a-...' LIMIT 3;
SELECT id FROM locations WHERE tenant_id = '0c54b84a-...' LIMIT 3;
SELECT id FROM cost_centers WHERE tenant_id = '0c54b84a-...' LIMIT 3;
```

### 0.3 Conteggi Attesi
Interroga il DB e registra i conteggi ESATTI per RTL Bank. Ogni tabella DEVE mostrare questi numeri.

---

## FASE 1: PAGINE PUBBLICHE (3 pagine)

### P1. Home `/`
- [ ] Pagina carica senza errori
- [ ] Header con logo "Heuresys" visibile
- [ ] Menu navigazione: "Funzionalita", "Piattaforma", "Intelligence"
- [ ] Pulsanti "Accedi" e "Prova Gratuita" visibili
- [ ] Hero section con titolo e sottotitolo
- [ ] Sezione features visibile
- [ ] Footer con link funzionanti
- [ ] Click "Accedi" naviga a `/login`
- [ ] Screenshot: `p1-home.png`

### P2. Login `/login`
- [ ] Form login visibile: campi username e password
- [ ] Pulsante "Accedi" presente
- [ ] Credenziali demo visibili in basso
- [ ] Toggle dark mode funziona
- [ ] Freccia indietro naviga a `/`
- [ ] **Login valido** (`rtl-admin`/`Admin2026`): redirect a `/admin`, header mostra "RTL Bank"
- [ ] **Login invalido** (`fake`/`fake`): messaggio errore leggibile (NON `[object Object]`)
- [ ] **Campi vuoti**: validazione impedisce submit
- [ ] Screenshot: `p2-login.png`, `p2-login-error.png`

### P3. Pagina 403 `/403`
- [ ] Messaggio "Accesso Negato" o equivalente
- [ ] Link per tornare alla home o login
- [ ] Screenshot: `p3-403.png`

---

## FASE 2: ADMIN DASHBOARD (1 pagina)

### P4. Dashboard `/admin`
- [ ] Carica entro 5 secondi, nessun spinner infinito
- [ ] **KPI Cards** (verificare che i numeri siano > 0 e corretti):
  - [ ] Headcount: numero intero (RTL Bank = 156)
  - [ ] Turnover Rate: percentuale con `%`
  - [ ] Engagement Score: numero reale (NON fallback 4.2, NON 0 se dati presenti)
  - [ ] Open Positions o Recognition: numero
- [ ] **Grafico Headcount per Dipartimento**: barre visibili con label dipartimenti reali
- [ ] **Grafico Trend Organico**: linea con punti, almeno 6 mesi
- [ ] **Completamento Obiettivi**: percentuale con indicatore visivo
- [ ] **Turnover per Dipartimento**: dati reali
- [ ] **Attivita Recenti**: lista con almeno 1 elemento
- [ ] **Azioni Rapide**: pulsanti cliccabili che navigano
- [ ] Sidebar completamente visibile con tutte le voci di menu
- [ ] Header: tenant name, user name, notifiche
- [ ] Screenshot: `p4-dashboard-top.png`, `p4-dashboard-charts.png`, `p4-dashboard-bottom.png`

---

## FASE 3: ADMIN — EMPLOYEES (9 pagine)

### P5. Lista Dipendenti `/admin/employees`
- [ ] Tabella visibile con righe di dati
- [ ] Header mostra conteggio totale (es. "156 dipendenti")
- [ ] Colonne visibili: Nome (con avatar/iniziali), Email, Ruolo, Dipartimento, Sede, Data Assunzione, Stato
- [ ] **Ricerca**: digita un nome, tabella filtra correttamente, risultati coerenti
- [ ] **Filtro Dipartimento**: select dropdown con dipartimenti reali, filtra tabella
- [ ] **Filtro Stato**: Tutti/Attivo/Inattivo
- [ ] **Paginazione**: Pagina 1 di N visibile, bottoni Next/Prev funzionano, conteggio aggiorna
- [ ] **Pulsante "Nuovo Dipendente"**: presente e cliccabile
- [ ] **Pulsante Refresh**: ricarica dati
- [ ] **Click su riga**: naviga a dettaglio dipendente
- [ ] Badge "Attivo"/"Inattivo" colorato correttamente (verde/grigio)
- [ ] Date formattate in italiano
- [ ] Screenshot: `p5-employees-list.png`, `p5-employees-search.png`, `p5-employees-filtered.png`, `p5-employees-page2.png`

### P6. Nuovo Dipendente `/admin/employees/new`
- [ ] Form visibile con campi: Nome, Cognome, Email, Telefono, Dipartimento, Ruolo, Sede, Data Assunzione
- [ ] Dropdown Dipartimento popola con dipartimenti reali dal DB
- [ ] Dropdown Sede popola con sedi reali
- [ ] Validazione: submit con campi vuoti mostra errori
- [ ] Pulsante "Salva" presente
- [ ] Pulsante "Annulla" torna alla lista
- [ ] Screenshot: `p6-employee-new.png`, `p6-employee-new-validation.png`

### P7. Onboarding `/admin/employees/onboarding`
- [ ] Pagina carica senza errori
- [ ] Lista dipendenti in onboarding O form/wizard onboarding
- [ ] Dati reali (se ci sono dipendenti in onboarding nel DB)
- [ ] Screenshot: `p7-onboarding.png`

### P8. Dettaglio Dipendente `/admin/employees/{id}`
- [ ] Naviga con ID reale dal DB
- [ ] Nome completo visibile in header
- [ ] Foto/avatar
- [ ] Dati personali: email, telefono, data nascita
- [ ] Dati lavorativi: dipartimento, ruolo, sede, data assunzione
- [ ] Badge stato (Attivo/Inattivo)
- [ ] Tab o link a: Contratti, Documenti, Storico, Competenze
- [ ] Pulsante "Modifica" presente
- [ ] Dati corrispondono a quelli in DB
- [ ] Screenshot: `p8-employee-detail.png`

### P9. Modifica Dipendente `/admin/employees/{id}/edit`
- [ ] Form precompilato con dati attuali del dipendente
- [ ] Tutti i campi editabili
- [ ] Pulsante "Salva" e "Annulla"
- [ ] Modifica un campo, salva, verifica aggiornamento
- [ ] Screenshot: `p9-employee-edit.png`

### P10. Contratti Dipendente `/admin/employees/{id}/contracts`
- [ ] Lista contratti del dipendente
- [ ] Colonne: Tipo, Data Inizio, Data Fine, CCNL, Livello
- [ ] Se non ci sono contratti: messaggio appropriato (non errore)
- [ ] Screenshot: `p10-employee-contracts.png`

### P11. Documenti Dipendente `/admin/employees/{id}/documents`
- [ ] Lista documenti del dipendente
- [ ] Colonne: Nome, Tipo, Data Upload, Dimensione
- [ ] Pulsante Upload presente
- [ ] Se non ci sono documenti: messaggio appropriato
- [ ] Screenshot: `p11-employee-documents.png`

### P12. Storico Dipendente `/admin/employees/{id}/history`
- [ ] Timeline o lista cambiamenti
- [ ] Mostra: data, tipo modifica, campo modificato, valore precedente/nuovo
- [ ] Ordine cronologico (piu recente in alto)
- [ ] Screenshot: `p12-employee-history.png`

### P13. Competenze Dipendente `/admin/employees/{id}/skills`
- [ ] Lista competenze assegnate
- [ ] Per ogni skill: nome, livello, data valutazione
- [ ] Pulsante per aggiungere competenza
- [ ] Screenshot: `p13-employee-skills.png`

---

## FASE 4: ADMIN — DEPARTMENTS (5 pagine)

### P14. Lista Dipartimenti `/admin/departments`
- [ ] Tabella con dipartimenti reali
- [ ] Conteggio header corretto
- [ ] Colonne: Nome, Manager, N. Dipendenti, Parent, Stato
- [ ] Ricerca funziona
- [ ] Pulsante "Nuovo Dipartimento"
- [ ] Click su riga naviga a dettaglio
- [ ] Screenshot: `p14-departments-list.png`

### P15. Nuovo Dipartimento `/admin/departments/new`
- [ ] Form: Nome, Descrizione, Manager (select con dipendenti reali), Parent Dept, Budget
- [ ] Validazione campi obbligatori
- [ ] Submit crea dipartimento
- [ ] Screenshot: `p15-department-new.png`

### P16. Dettaglio Dipartimento `/admin/departments/{id}`
- [ ] Nome dipartimento in header
- [ ] Info: Manager, N. Dipendenti, Budget, Parent
- [ ] Lista dipendenti del dipartimento
- [ ] Link a modifica
- [ ] Screenshot: `p16-department-detail.png`

### P17. Modifica Dipartimento `/admin/departments/{id}/edit`
- [ ] Form precompilato con dati attuali
- [ ] Modifica e salva funziona
- [ ] Screenshot: `p17-department-edit.png`

### P18. Statistiche Dipartimento `/admin/departments/{id}/stats`
- [ ] Grafici/metriche per il dipartimento
- [ ] Headcount trend, turnover, performance media
- [ ] Dati reali non placeholder
- [ ] Screenshot: `p18-department-stats.png`

---

## FASE 5: ADMIN — ORG UNITS (4 pagine)

### P19. Lista Unita Organizzative `/admin/org-units`
- [ ] Tabella o tree view con unita
- [ ] Colonne: Nome, Tipo, Manager, N. Dipendenti
- [ ] Gerarchia visibile (parent-child)
- [ ] Ricerca funziona
- [ ] Pulsante "Nuova Unita"
- [ ] Screenshot: `p19-org-units-list.png`

### P20. Nuova Unita `/admin/org-units/new`
- [ ] Form: Nome, Tipo, Manager, Parent Unit
- [ ] Dropdown con unita esistenti per parent
- [ ] Screenshot: `p20-org-unit-new.png`

### P21. Dettaglio Unita `/admin/org-units/{id}`
- [ ] Info unita: nome, tipo, manager, parent
- [ ] Lista sotto-unita (se esistono)
- [ ] Lista dipendenti assegnati
- [ ] Screenshot: `p21-org-unit-detail.png`

### P22. Modifica Unita `/admin/org-units/{id}/edit`
- [ ] Form precompilato
- [ ] Salvataggio funziona
- [ ] Screenshot: `p22-org-unit-edit.png`

---

## FASE 6: ADMIN — LOCATIONS (4 pagine)

### P23. Lista Sedi `/admin/locations`
- [ ] Tabella con sedi reali
- [ ] Colonne: Nome, Indirizzo, Citta, Paese, N. Dipendenti
- [ ] Pulsante "Nuova Sede"
- [ ] Click su riga naviga a dettaglio
- [ ] Screenshot: `p23-locations-list.png`

### P24. Nuova Sede `/admin/locations/new`
- [ ] Form: Nome, Indirizzo, Citta, CAP, Paese, Telefono, Email
- [ ] Validazione
- [ ] Screenshot: `p24-location-new.png`

### P25. Dettaglio Sede `/admin/locations/{id}`
- [ ] Info sede completa
- [ ] Lista dipendenti in questa sede
- [ ] Screenshot: `p25-location-detail.png`

### P26. Modifica Sede `/admin/locations/{id}/edit`
- [ ] Form precompilato
- [ ] Salvataggio funziona
- [ ] Screenshot: `p26-location-edit.png`

---

## FASE 7: ADMIN — COST CENTERS (4 pagine)

### P27. Lista Centri di Costo `/admin/cost-centers`
- [ ] Tabella con centri reali
- [ ] Colonne: Codice, Nome, Manager, Budget, Stato
- [ ] Pulsante "Nuovo Centro"
- [ ] Screenshot: `p27-cost-centers-list.png`

### P28. Nuovo Centro `/admin/cost-centers/new`
- [ ] Form: Codice, Nome, Manager, Budget, Descrizione
- [ ] Validazione
- [ ] Screenshot: `p28-cost-center-new.png`

### P29. Dettaglio Centro `/admin/cost-centers/{id}`
- [ ] Info centro completa
- [ ] Budget allocato vs speso
- [ ] Screenshot: `p29-cost-center-detail.png`

### P30. Modifica Centro `/admin/cost-centers/{id}/edit`
- [ ] Form precompilato
- [ ] Salvataggio funziona
- [ ] Screenshot: `p30-cost-center-edit.png`

---

## FASE 8: ADMIN — GOALS (3 pagine)

### P31. Lista Obiettivi `/admin/goals`
- [ ] Tabella con obiettivi reali (NON vuota)
- [ ] Conteggio corretto in header
- [ ] Colonne: Titolo, Dipendente, Tipo, Periodo, Stato, Progresso %
- [ ] **Filtro Stato**: In Progress / Completed / Not Started / etc.
- [ ] **Ricerca**: per titolo o dipendente
- [ ] **Paginazione**: funziona correttamente
- [ ] Barra progresso colorata (verde > 75%, giallo 50-75%, rosso < 50%)
- [ ] Badge stato con colori appropriati
- [ ] Screenshot: `p31-goals-list.png`, `p31-goals-filtered.png`

### P32. Nuovo Obiettivo `/admin/goals/new`
- [ ] Form: Titolo, Descrizione, Dipendente (select reale), Tipo, Data Inizio, Data Fine
- [ ] Sezione KPIs/metriche
- [ ] Validazione campi obbligatori
- [ ] Submit crea obiettivo
- [ ] Screenshot: `p32-goal-new.png`

### P33. Obiettivi a Cascata `/admin/goals/cascading`
- [ ] Vista gerarchica: Aziendali -> Team -> Individuali
- [ ] Albero o grafo con linee di connessione
- [ ] Espandi/comprimi nodi
- [ ] Ogni nodo mostra: titolo, owner, progresso
- [ ] Screenshot: `p33-goals-cascading.png`

---

## FASE 9: ADMIN — PERFORMANCE (2 pagine)

### P34. Valutazioni `/admin/reviews`
- [ ] Tabella con valutazioni (NON "Nessuna valutazione trovata" — RTL Bank ha 155 reviews)
- [ ] Conteggio header corretto
- [ ] Colonne: Dipendente, Valutatore, Tipo, Periodo, Stato, Rating
- [ ] **Stats Cards** in alto: Totale, In Corso, Completate, Valutazione Media
- [ ] Valutazione media con stella e numero (es. ★ 3.8)
- [ ] **Filtro Stato**: Bozza / In Attesa / In Corso / Completata / Annullata
- [ ] **Ricerca**: per dipendente o valutatore
- [ ] **Paginazione**: funziona
- [ ] Badge stato colorati correttamente
- [ ] Tipo review tradotto (Annuale, Semestrale, etc.)
- [ ] Periodo formattato "gen 2026 - giu 2026"
- [ ] Screenshot: `p34-reviews-list.png`, `p34-reviews-stats.png`

### P35. Check-in `/admin/check-ins`
- [ ] Tabella con check-in (NON "Nessun check-in trovato" — RTL Bank ha 1620)
- [ ] Conteggio header corretto
- [ ] Colonne: Dipendente, Manager, Data, Tipo, Stato, Durata
- [ ] **Stats Cards**: Totale, Programmati, Completati, Mood Medio
- [ ] Mood medio con icona smile e numero (es. 😊 3.5)
- [ ] **Filtro Stato**: Programmato / Completato / Annullato / Assente
- [ ] **Ricerca**: per dipendente o manager
- [ ] **Paginazione**: funziona
- [ ] Tipo check-in tradotto (1:1, Settimanale, Mensile, etc.)
- [ ] Durata formattata (30 min, 1h, 1h 30m)
- [ ] Data in formato italiano
- [ ] Screenshot: `p35-checkins-list.png`, `p35-checkins-stats.png`

---

## FASE 10: ADMIN — FORMAZIONE (3 pagine)

### P36. Lista Corsi `/admin/courses`
- [ ] Tabella/griglia con corsi reali
- [ ] Conteggio corretto
- [ ] Info per corso: Titolo, Categoria, Durata, Iscritti, Stato
- [ ] Filtro per categoria
- [ ] Ricerca per titolo
- [ ] Paginazione
- [ ] Pulsante "Nuovo Corso"
- [ ] Screenshot: `p36-courses-list.png`

### P37. Nuovo Corso `/admin/courses/new`
- [ ] Form: Titolo, Descrizione, Categoria, Durata, Max Iscritti, Prerequisiti
- [ ] Editor rich text per descrizione (se presente)
- [ ] Validazione
- [ ] Submit crea corso
- [ ] Screenshot: `p37-course-new.png`

### P38. Iscrizioni `/admin/courses/enrollments`
- [ ] Tabella iscrizioni
- [ ] Colonne: Corso, Dipendente, Data Iscrizione, Progresso %, Stato, Completamento
- [ ] Filtro per stato (In Corso, Completato, Abbandonato)
- [ ] Ricerca
- [ ] Paginazione
- [ ] Screenshot: `p38-enrollments-list.png`

---

## FASE 11: ADMIN — COMPETENZE E CERTIFICAZIONI (2 pagine)

### P39. Competenze `/admin/skills`
- [ ] Tabella o griglia competenze
- [ ] Colonne: Nome, Categoria, Livello, N. Dipendenti con skill
- [ ] Categorie raggruppate
- [ ] Ricerca funziona
- [ ] Pulsante "Nuova Competenza"
- [ ] Screenshot: `p39-skills-list.png`

### P40. Certificazioni `/admin/certifications`
- [ ] Tabella certificazioni
- [ ] Colonne: Nome, Ente Certificatore, N. Certificati, Scadenza, Stato
- [ ] Filtro per stato (Attiva, Scaduta, In Scadenza)
- [ ] Ricerca
- [ ] Pulsante "Nuova Certificazione"
- [ ] Screenshot: `p40-certifications-list.png`

---

## FASE 12: ADMIN — FEEDBACK E RECRUITING (3 pagine)

### P41. Feedback `/admin/feedback`
- [ ] Dati presenti (NON vuoto se DB ha feedback)
- [ ] **Tab o sezioni**: Feedback Continuo, 360, Wall
- [ ] Tab Continuo: lista feedback con mittente, destinatario, data, testo
- [ ] Tab 360: review 360 gradi
- [ ] Tab Wall: bacheca feedback pubblici
- [ ] Filtro per tipo/data
- [ ] Pulsante "Nuovo Feedback"
- [ ] Screenshot: `p41-feedback-continuous.png`, `p41-feedback-360.png`, `p41-feedback-wall.png`

### P42. Candidati `/admin/candidates`
- [ ] Pipeline Kanban O tabella con candidati
- [ ] Fasi pipeline: Nuovo, Screening, Colloquio, Offerta, Assunto, Rifiutato
- [ ] Per ogni candidato: nome, posizione, data, stato
- [ ] Stats cards: Totale, Per fase
- [ ] Filtro per posizione
- [ ] Ricerca per nome
- [ ] Click apre dettaglio candidato
- [ ] Screenshot: `p42-candidates-pipeline.png`

### P43. Posizioni Aperte `/admin/positions`
- [ ] Tabella job postings
- [ ] Colonne: Titolo, Dipartimento, Sede, N. Candidati, Data Pubblicazione, Stato
- [ ] Filtro per stato (Aperta, Chiusa, Bozza)
- [ ] Pulsante "Nuova Posizione"
- [ ] Screenshot: `p43-positions-list.png`

---

## FASE 13: ADMIN — UTENTI E SETTINGS (2 pagine)

### P44. Gestione Utenti `/admin/users`
- [ ] Tabella utenti (NON "Nessun utente trovato")
- [ ] Conteggio corretto
- [ ] Colonne: Username, Nome Completo, Email, Ruolo, Stato, Ultimo Accesso
- [ ] **Badge Ruolo** colorato: SYSADMIN (rosso), ADMIN (viola), HR (blu), USER (grigio), DEMO (giallo)
- [ ] **Badge Stato**: Attivo (verde), Inattivo (grigio)
- [ ] Ultimo accesso formattato in italiano
- [ ] **Ricerca**: per username, nome o email
- [ ] **Pulsante "Nuovo Utente"**: apre dialog
- [ ] **Dialog Nuovo Utente**: campi Username, Email, Ruolo (select), submit funziona
- [ ] **Pulsante Edit** su ogni riga: apre dialog precompilata
- [ ] **Pulsante Delete** su ogni riga: chiede conferma, poi elimina
- [ ] **Refresh** ricarica dati
- [ ] Screenshot: `p44-users-list.png`, `p44-users-create-dialog.png`, `p44-users-edit-dialog.png`

### P45. Impostazioni `/admin/settings`
- [ ] Form configurazione tenant
- [ ] Campi: Nome Tenant, Descrizione, Lingua, Timezone, Logo
- [ ] Sezioni: Generali, Notifiche, Sicurezza (se presenti)
- [ ] Salvataggio funziona
- [ ] Screenshot: `p45-settings.png`

---

## FASE 14: ADMIN — ANALYTICS (6 pagine)

### P46. Analytics Dashboard `/admin/analytics`
- [ ] Dashboard con grafici principali
- [ ] KPI cards: Headcount, Turnover, Retention, Cost per Employee
- [ ] Grafici interattivi (hover mostra tooltip)
- [ ] Filtro periodo (ultimo mese, trimestre, anno)
- [ ] Dati reali calcolati dal DB
- [ ] Screenshot: `p46-analytics-dashboard.png`

### P47. Export Report `/admin/analytics/export`
- [ ] Form per generare report
- [ ] Selezione tipo report (HR Overview, Performance, etc.)
- [ ] Selezione periodo (da-a)
- [ ] Selezione formato (CSV, Excel, PDF)
- [ ] Pulsante "Genera" funziona (o mostra loading)
- [ ] Screenshot: `p47-analytics-export.png`

### P48. Analytics AI `/admin/analytics/ai`
- [ ] Pagina carica senza errori
- [ ] Interfaccia AI insights o chat analytics
- [ ] Dati/grafici generati dall'AI
- [ ] Screenshot: `p48-analytics-ai.png`

### P49. Analytics Presenze `/admin/analytics/attendance`
- [ ] Dashboard presenze
- [ ] Grafici: presenze/assenze per periodo
- [ ] Tabella dettaglio
- [ ] Filtri per periodo e dipartimento
- [ ] Screenshot: `p49-analytics-attendance.png`

### P50. Analytics Compensation `/admin/analytics/compensation`
- [ ] Dashboard compensi
- [ ] Grafici: distribuzione salari, costo per dipartimento
- [ ] Confronti e trend
- [ ] Screenshot: `p50-analytics-compensation.png`

### P51. Analytics Workforce `/admin/analytics/workforce`
- [ ] Dashboard workforce
- [ ] Grafici: eta, anzianita, genere, contratti
- [ ] Piramide demografica o distribuzione
- [ ] Screenshot: `p51-analytics-workforce.png`

---

## FASE 15: ADMIN — MARKETPLACE (8 pagine)

### P52. Catalogo Marketplace `/admin/marketplace`
- [ ] Griglia o lista plugin disponibili
- [ ] Per ogni plugin: nome, descrizione, icona, rating, prezzo
- [ ] Ricerca plugin
- [ ] Filtro per categoria
- [ ] Click su plugin naviga a dettaglio
- [ ] Screenshot: `p52-marketplace-catalog.png`

### P53. Dettaglio Plugin `/admin/marketplace/{id}`
- [ ] Nome, descrizione estesa, screenshot
- [ ] Pulsante "Installa" o "Gia Installato"
- [ ] Requisiti, versione, autore
- [ ] Review/rating
- [ ] Screenshot: `p53-marketplace-plugin-detail.png`

### P54. Plugin Installati `/admin/marketplace/installed`
- [ ] Lista plugin installati
- [ ] Per ognuno: nome, versione, stato (attivo/disattivo)
- [ ] Pulsanti: Configura, Disattiva, Disinstalla
- [ ] Screenshot: `p54-marketplace-installed.png`

### P55. Webhooks Plugin `/admin/marketplace/installed/{id}/webhooks`
- [ ] Lista webhooks configurati per il plugin
- [ ] Per ognuno: URL, eventi, stato
- [ ] Pulsante "Nuovo Webhook"
- [ ] Test webhook funziona
- [ ] Screenshot: `p55-marketplace-webhooks.png`

### P56. Developer Portal `/admin/marketplace/developer`
- [ ] Lista plugin sviluppati
- [ ] Metriche: installazioni, rating, revenue
- [ ] Pulsante "Nuovo Plugin"
- [ ] Screenshot: `p56-marketplace-developer.png`

### P57. Nuovo Plugin `/admin/marketplace/developer/new`
- [ ] Form creazione plugin: nome, descrizione, categoria, versione
- [ ] Upload icona
- [ ] Configurazione permessi
- [ ] Screenshot: `p57-marketplace-plugin-new.png`

### P58. Gestione Plugin `/admin/marketplace/developer/{pluginId}`
- [ ] Dettaglio plugin sviluppato
- [ ] Metriche
- [ ] Form modifica
- [ ] Screenshot: `p58-marketplace-plugin-manage.png`

### P59. API Keys `/admin/marketplace/api-keys`
- [ ] Lista API keys
- [ ] Per ognuna: nome, key (mascherata), data creazione, stato
- [ ] Pulsante "Nuova API Key"
- [ ] Pulsante copia key
- [ ] Pulsante revoca
- [ ] Screenshot: `p59-marketplace-api-keys.png`

---

## FASE 16: ADMIN — ORG CHART (1 pagina)

### P61. Organigramma `/admin/org-chart`
- [ ] Visualizzazione grafica organizzazione
- [ ] Nodi con: nome, ruolo, foto/avatar
- [ ] Linee gerarchiche visibili
- [ ] Zoom in/out funziona
- [ ] Pan (trascinamento) funziona
- [ ] Click su nodo mostra dettaglio
- [ ] Espandi/comprimi rami
- [ ] Screenshot: `p61-org-chart.png`, `p61-org-chart-zoomed.png`

---

## FASE 17: ADMIN — CAREER (8 pagine)

### P62. Career Dashboard `/admin/career`
- [ ] Panoramica programmi carriera
- [ ] KPI: dipendenti con career path, skill gap, mentoring attivo
- [ ] Widget o cards riassuntive
- [ ] Link alle sotto-pagine
- [ ] Screenshot: `p62-career-dashboard.png`

### P63. Career Goals `/admin/career/goals`
- [ ] Lista obiettivi di carriera (diversi da goals performance)
- [ ] Filtri e ricerca
- [ ] Conteggio corretto
- [ ] Screenshot: `p63-career-goals.png`

### P64. Career Reports `/admin/career/reports`
- [ ] Report su sviluppo carriera
- [ ] Grafici: progressione, skill acquisition, promotion rate
- [ ] Dati reali dal DB
- [ ] Screenshot: `p64-career-reports.png`

### P65. Career Chat AI `/admin/career/chat`
- [ ] Interfaccia chat
- [ ] Campo input per messaggio
- [ ] Pulsante invio
- [ ] Invio messaggio: risposta AI visibile (o errore gestito se AI non configurata)
- [ ] Storico messaggi
- [ ] Screenshot: `p65-career-chat.png`, `p65-career-chat-response.png`

### P66. Career Learning `/admin/career/learning`
- [ ] Learning paths definiti
- [ ] Per ogni path: titolo, corsi inclusi, durata, progresso
- [ ] Screenshot: `p66-career-learning.png`

### P67. Career Mentors `/admin/career/mentors`
- [ ] Lista mentor disponibili
- [ ] Per ognuno: nome, competenze, mentee assegnati
- [ ] Pulsante assegna mentor
- [ ] Screenshot: `p67-career-mentors.png`

### P68. Career Paths `/admin/career/paths`
- [ ] Percorsi di carriera definiti
- [ ] Visualizzazione: da ruolo A a ruolo B con requisiti
- [ ] Grafo o lista
- [ ] Screenshot: `p68-career-paths.png`

### P69. Career Skills `/admin/career/skills`
- [ ] Matrice competenze carriera
- [ ] Skill gap analysis
- [ ] Per dipendente o per ruolo
- [ ] Screenshot: `p69-career-skills.png`

---

## FASE 18: PORTAL — Employee Self-Service (6 pagine)

**Login come utente USER di RTL Bank per questa fase.**

### P70. Portal Dashboard `/portal`
- [ ] Benvenuto con nome dipendente
- [ ] KPI personali: obiettivi, corsi, ferie residue
- [ ] Widget "I miei obiettivi" con progresso
- [ ] Widget "I miei corsi" con stato
- [ ] Prossimi eventi/scadenze
- [ ] Screenshot: `p70-portal-dashboard.png`

### P71. Profilo Personale `/portal/profile`
- [ ] Dati personali visibili: nome, cognome, email, telefono
- [ ] Dati lavorativi: dipartimento, ruolo, sede, data assunzione
- [ ] Avatar/foto
- [ ] Campi editabili (email personale, telefono, indirizzo)
- [ ] Pulsante "Salva Modifiche"
- [ ] Dati corretti da DB
- [ ] Screenshot: `p71-portal-profile.png`

### P72. I Miei Obiettivi `/portal/goals`
- [ ] Lista obiettivi assegnati al dipendente loggato
- [ ] Per ogni obiettivo: titolo, periodo, stato, progresso
- [ ] Possibilita di aggiornare progresso
- [ ] Filtro per stato
- [ ] Screenshot: `p72-portal-goals.png`

### P73. Formazione `/portal/learning`
- [ ] I miei corsi iscritti con stato
- [ ] Catalogo corsi disponibili
- [ ] Pulsante "Iscriviti" per corsi non iscritti
- [ ] Progresso corsi in corso
- [ ] Screenshot: `p73-portal-learning.png`

### P74. Documenti `/portal/documents`
- [ ] I miei documenti (busta paga, contratto, etc.)
- [ ] Per ogni documento: nome, tipo, data
- [ ] Pulsante download
- [ ] Pulsante upload (se permesso)
- [ ] Screenshot: `p74-portal-documents.png`

### P75. Ferie e Permessi `/portal/time-off`
- [ ] **Saldo ferie**: giorni residui, usati, totali
- [ ] **Storico richieste**: data, tipo, stato (Approvata/Rifiutata/In Attesa)
- [ ] **Pulsante "Nuova Richiesta"**: form con tipo, data inizio, data fine, note
- [ ] Calendario visivo (se presente)
- [ ] Screenshot: `p75-portal-timeoff.png`, `p75-portal-timeoff-request.png`

---

## FASE 19: PLATFORM — Sysadmin (6 pagine)

**Login come `sysadmin` per questa fase.**

### P76. Platform Dashboard `/platform`
- [ ] KPI piattaforma: N. Tenant, N. Utenti Totali, N. Dipendenti Totali, Storage
- [ ] Numeri reali dal DB (4 tenant, 271 utenti, 267 dipendenti)
- [ ] Grafici: utenti per tenant, crescita nel tempo
- [ ] Stato servizi (API, DB, Storage)
- [ ] Screenshot: `p76-platform-dashboard.png`

### P77. Gestione Tenant `/platform/tenants`
- [ ] Lista tenant (4 tenant reali)
- [ ] Per ognuno: Nome, Codice, N. Utenti, N. Dipendenti, Stato, Data Creazione
- [ ] Pulsante "Nuovo Tenant"
- [ ] Click su tenant mostra dettaglio/edit
- [ ] Screenshot: `p77-platform-tenants.png`

### P78. Utenti Globali `/platform/users`
- [ ] Lista utenti cross-tenant (271 utenti)
- [ ] Colonne: Username, Nome, Tenant, Ruolo, Stato
- [ ] Filtro per tenant
- [ ] Ricerca
- [ ] Paginazione
- [ ] Screenshot: `p78-platform-users.png`

### P79. Stato Database `/platform/database`
- [ ] Metriche DB: dimensione, connessioni attive, uptime
- [ ] Tabelle: count, dimensioni
- [ ] Status: healthy/unhealthy
- [ ] Screenshot: `p79-platform-database.png`

### P80. Sicurezza e Audit `/platform/security`
- [ ] Audit log: lista eventi
- [ ] Per evento: timestamp, utente, azione, IP, dettagli
- [ ] Filtro per tipo evento, utente, periodo
- [ ] Paginazione
- [ ] Configurazione SSO (se presente)
- [ ] Screenshot: `p80-platform-security.png`

### P81. Impostazioni Piattaforma `/platform/settings`
- [ ] Configurazione globale: nome piattaforma, dominio, SMTP
- [ ] Sezione sicurezza: password policy, session timeout
- [ ] Sezione email: SMTP config
- [ ] Salvataggio funziona
- [ ] Screenshot: `p81-platform-settings.png`

---

## FASE 20: NAVIGAZIONE E SIDEBAR

### Test Sidebar Completa
Per OGNI voce del menu sidebar:
- [ ] Click naviga alla pagina corretta
- [ ] Voce attiva evidenziata visivamente
- [ ] Sottomenu si espande al click sulla freccia
- [ ] Sottomenu si comprime al secondo click
- [ ] Icona appropriata per ogni voce
- [ ] Nessun link rotto (404)
- [ ] Screenshot sidebar aperta e chiusa

### Test Header
- [ ] Logo "Heuresys" cliccabile → torna a dashboard
- [ ] **Tenant selector** (solo sysadmin): dropdown con 4 tenant, cambio tenant ricarica dati
- [ ] **Campo ricerca globale**: presente, funzionante
- [ ] **Notifiche**: icona campanella con badge contatore
- [ ] **User menu**: click mostra dropdown con nome, ruolo, logout
- [ ] **Tema**: toggle dark/light mode

### Test Responsive
- [ ] Sidebar collassa su mobile (< 768px)
- [ ] Hamburger menu appare
- [ ] Tabelle hanno scroll orizzontale su mobile
- [ ] Form sono usabili su mobile

---

## FASE 21: VALIDAZIONE DATI CROSS-PAGE

### Conteggi Coerenti
- [ ] Dashboard headcount == conteggio in `/admin/employees`
- [ ] Dashboard obiettivi completati == filtro "Completed" in `/admin/goals`
- [ ] Dashboard valutazioni == conteggio in `/admin/reviews`
- [ ] Stats cards nelle pagine lista == totale nella paginazione

### Formattazione Consistente
- [ ] TUTTE le date in formato italiano (dd MMM yyyy o dd/MM/yyyy)
- [ ] TUTTE le percentuali con simbolo %
- [ ] NESSUN `NaN`, `undefined`, `null`, `[object Object]` visibile
- [ ] NESSUN testo inglese dove dovrebbe essere italiano

### Errori da Cercare
- [ ] ZERO pagine con "Nessun dato" quando DB ha dati per quel tenant
- [ ] ZERO console.error critici
- [ ] ZERO Network errors 4xx/5xx nelle richieste API (verificare tab Network)
- [ ] ZERO componenti che non si renderizzano (box vuoti, skeleton infiniti)

---

## FASE 22: INTERAZIONI COMPLETE

### Per OGNI Pulsante nella UI
- [ ] Click esegue l'azione corretta
- [ ] Loading state visibile durante operazione asincrona
- [ ] Feedback success (toast/messaggio) dopo operazione riuscita
- [ ] Feedback error con messaggio leggibile dopo fallimento
- [ ] Pulsante disabilitato quando non applicabile
- [ ] Double-click non causa duplicazione

### Per OGNI Form
- [ ] Campi obbligatori marcati (asterisco o testo)
- [ ] Submit con campi vuoti mostra errori inline
- [ ] Errori specifici per campo (non generico)
- [ ] Submit valido invia dati corretti all'API
- [ ] Redirect o aggiornamento dopo submit riuscito
- [ ] Pulsante "Annulla" torna indietro senza salvare

### Per OGNI Modale/Dialog
- [ ] Si apre correttamente
- [ ] Overlay scuro visibile
- [ ] ESC chiude
- [ ] Click fuori chiude (se appropriato)
- [ ] Pulsanti Cancel e Confirm funzionano
- [ ] Form dentro dialog validano correttamente

### Per OGNI Filtro/Ricerca
- [ ] Filtro aggiorna risultati
- [ ] Ricerca trova risultati corretti
- [ ] Ricerca vuota ripristina tutti i risultati
- [ ] Combinazione filtri funziona
- [ ] Reset filtri ripristina stato iniziale
- [ ] Paginazione si resetta quando si cambia filtro

### Per OGNI Tabella
- [ ] Header colonne visibili e leggibili
- [ ] Dati nelle celle formattati correttamente
- [ ] Righe alternate (zebra striping) o hover highlight
- [ ] Click su riga naviga (se previsto)
- [ ] Ordinamento colonne (se implementato)
- [ ] Paginazione con conteggio totale accurato

---

## CHECKLIST FINALE

Prima di dichiarare SUCCESSO:

- [ ] TUTTE le 81 pagine testate individualmente
- [ ] TUTTI gli screenshot salvati (almeno 100+)
- [ ] ZERO pagine con "Nessun dato" quando DB ha dati
- [ ] ZERO errori console critici
- [ ] ZERO `[object Object]` visibili
- [ ] ZERO `NaN`, `undefined`, `null` visibili nel testo
- [ ] TUTTE le API calls verificate (tab Network pulito)
- [ ] TUTTI i pulsanti cliccati e verificati
- [ ] TUTTE le form testate (validazione + submit)
- [ ] TUTTI i filtri e ricerche testati
- [ ] TUTTE le paginazioni testate (inclusi edge case)
- [ ] Navigazione sidebar completa testata
- [ ] Dati coerenti tra dashboard e pagine di dettaglio
- [ ] Pipeline CRUD completa per entita principali (Fase 30)
- [ ] Gestione errori rete e sessione scaduta testata (Fase 28)
- [ ] Edge cases: zero dati, ricerca vuota, caratteri speciali (Fase 29)
- [ ] Upload e download file testati (Fase 23)
- [ ] Drag & drop testato dove presente (Fase 24)
- [ ] AI chat testata (Fase 25)
- [ ] Responsive a 3 viewport testato (Fase 26)
- [ ] Accessibilita base verificata (Fase 27)
- [ ] Report completo scritto con evidenze screenshot

---

## SE FALLISCI

1. **STOP** immediato — non andare avanti
2. **Documenta** ESATTAMENTE cosa non funziona (pagina, elemento, errore)
3. **Fixa** il problema (frontend o backend)
4. **Ritesta DA CAPO** quella sezione e tutte le pagine collegate
5. **NON dichiarare successo** finche TUTTO passa
6. **Screenshot PRIMA e DOPO** ogni fix come prova

---

---

## FASE 23: FILE UPLOAD E DOWNLOAD

### Per ogni pagina con upload (documenti, foto, plugin, corsi)
- [ ] Click su pulsante upload apre file picker
- [ ] Upload file di test (usare `page.setInputFiles` con file reale)
- [ ] Progresso upload visibile
- [ ] File appare nella lista dopo upload
- [ ] Nome file, dimensione, data corretti

### Per ogni pagina con download (documenti, export, report)
- [ ] Click su download avvia scaricamento
- [ ] Verificare che il file venga effettivamente scaricato (`page.waitForEvent('download')`)
- [ ] File scaricato ha dimensione > 0
- [ ] Screenshot: `p-upload-test.png`, `p-download-test.png`

---

## FASE 24: DRAG & DROP

### Kanban Candidati `/admin/candidates`
- [ ] Se pipeline Kanban: drag candidato da una colonna all'altra (`page.locator().dragTo()`)
- [ ] Verifica che lo stato del candidato cambi dopo il drop
- [ ] Screenshot prima e dopo: `p-kanban-before.png`, `p-kanban-after.png`

### Org Chart `/admin/org-chart`
- [ ] Pan (trascinamento) del grafo funziona
- [ ] Zoom con scroll funziona
- [ ] Screenshot: `p-orgchart-drag.png`

---

## FASE 25: AI CHAT REALE

### Career Chat `/admin/career/chat`
- [ ] Digita messaggio di test: "Quali competenze servono per diventare manager?"
- [ ] Click invio
- [ ] Verifica risposta AI appare OPPURE errore gestito ("Servizio AI non disponibile")
- [ ] Se risposta: testo leggibile, non JSON raw, non errore
- [ ] Se errore: messaggio user-friendly, non crash, non `[object Object]`
- [ ] Secondo messaggio nella stessa sessione funziona
- [ ] Screenshot: `p-ai-chat-question.png`, `p-ai-chat-response.png`

---

## FASE 26: RESPONSIVE / VIEWPORT

Testare OGNI sezione principale a 3 viewport:

### Desktop (1280x800)
- [ ] Layout completo, sidebar visibile, tabelle intere
- [ ] Screenshot: `p-responsive-desktop.png`

### Tablet (768x1024)
- [ ] Sidebar collassa o diventa hamburger
- [ ] Tabelle con scroll orizzontale se necessario
- [ ] Form usabili
- [ ] Screenshot: `p-responsive-tablet.png`

### Mobile (375x667)
- [ ] Hamburger menu appare
- [ ] Click hamburger apre sidebar
- [ ] Tabelle scrollabili orizzontalmente
- [ ] Form a colonna singola
- [ ] Pulsanti raggiungibili
- [ ] Testo leggibile (non troncato senza motivo)
- [ ] Screenshot: `p-responsive-mobile.png`

Pagine da testare responsive (minimo):
- [ ] Dashboard `/admin`
- [ ] Employees `/admin/employees`
- [ ] Goals `/admin/goals`
- [ ] Portal Dashboard `/portal`
- [ ] Login `/login`

---

## FASE 27: ACCESSIBILITA BASE

### Per ogni pagina principale
- [ ] Tutti gli `<img>` hanno `alt` attribute
- [ ] Tutti i pulsanti hanno testo leggibile o `aria-label`
- [ ] Tab navigation funziona (premere Tab, gli elementi ricevono focus in ordine logico)
- [ ] Focus visibile (outline o ring) sugli elementi interattivi
- [ ] Form label associate ai campi (`htmlFor`/`id`)
- [ ] Contrasto testo sufficiente (nessun testo grigio chiaro su bianco)
- [ ] Modale trappola focus (Tab non esce dalla modale aperta)
- [ ] ESC chiude modale

---

## FASE 28: GESTIONE ERRORI E SESSIONI (da review ChatGPT)

### Errori di Rete
Per ogni pagina con caricamento dati:
- [ ] Simula errore 500 backend (ferma API container o intercetta con `page.route`): pagina mostra messaggio user-friendly, NON crash, NON schermo bianco
- [ ] Simula errore 404 endpoint: messaggio "risorsa non trovata" o equivalente
- [ ] Simula network timeout: loader visibile, poi messaggio errore con pulsante "Riprova"
- [ ] Pulsante "Riprova" ricarica i dati correttamente

```javascript
// Esempio: intercettare API e forzare errore 500
await page.route('**/api/v1/employees**', route => route.fulfill({ status: 500, body: '{}' }));
await page.goto('/admin/employees');
// Verificare messaggio errore visibile
await expect(page.locator('text=Errore')).toBeVisible();
// Rimuovere intercettazione e verificare riprova
await page.unroute('**/api/v1/employees**');
await page.click('text=Riprova');
await expect(page.locator('table tbody tr')).toHaveCount(/* > 0 */);
```

### Sessione Scaduta
- [ ] Simula token scaduto (rimuovi token da localStorage mentre sei su una pagina admin)
- [ ] Verifica: la prossima API call gestisce il 401 correttamente
- [ ] Verifica: redirect a `/login` CON messaggio "Sessione scaduta" (non silenzioso)
- [ ] Verifica: pagina login funziona dopo redirect (non loop)

### Accesso Non Autorizzato
- [ ] Senza token: naviga a `/admin` — redirect a `/login`
- [ ] Con token USER: naviga a `/platform` — mostra 403 o redirect
- [ ] Con token HR: naviga a `/admin/users` — comportamento appropriato per permessi

---

## FASE 29: EDGE CASES E DATI LIMITE (da review ChatGPT)

### Pagine con Zero Dati
Per ogni pagina lista, testare anche con tenant che ha zero record per quell'entita:
- [ ] Messaggio "Nessun risultato" visibile (non tabella vuota senza spiegazione)
- [ ] Pulsante "Crea primo X" o azione suggerita
- [ ] Nessun errore JavaScript

### Ricerca Senza Risultati
- [ ] Cerca "zzzzxxx123" in ogni campo ricerca
- [ ] Messaggio "Nessun risultato" appropriato
- [ ] Clear ricerca ripristina tutti i dati

### Caratteri Speciali
- [ ] Cerca con caratteri speciali: `<script>alert(1)</script>`
- [ ] Nessun XSS, testo escapato correttamente
- [ ] Cerca con accenti italiani: "gia", "perche", "unita"
- [ ] Risultati corretti

### Paginazione Edge Cases
- [ ] Pagina 1 di 1: bottoni prev/next disabilitati
- [ ] Ultima pagina: bottone next disabilitato
- [ ] Conteggio "Mostrando 1-20 di 156" corretto matematicamente

---

## FASE 30: DIPENDENZE TRA TEST E ORDINE (da review ChatGPT)

### Pipeline CRUD Completa
Per Employees, Departments, Locations, Cost Centers, Goals, Courses:
1. [ ] **Lista**: Verifica dati esistenti, conta record
2. [ ] **Crea** (`/new`): Compila form, submit, verifica record in lista (+1)
3. [ ] **Dettaglio** (`/[id]`): Apri record appena creato, verifica dati
4. [ ] **Modifica** (`/[id]/edit`): Cambia un campo, salva, verifica aggiornamento
5. [ ] **Sub-pagine** (`/[id]/contracts`, `/[id]/skills`, etc.): Verifica navigazione e dati
6. [ ] **Elimina** (se presente): Elimina record di test, verifica scomparsa dalla lista (-1)

**REGOLA:** I test CRUD devono essere eseguiti IN SEQUENZA (create prima di read/update/delete). I test di sola lettura possono essere paralleli.

---

## FASE 31: BEST PRACTICES PLAYWRIGHT (da review ChatGPT)

### Struttura Test
```javascript
// SEMPRE attendere elementi prima di interagire
await page.waitForSelector('table tbody tr', { timeout: 10000 });

// SEMPRE usare locator robusti (non fragili)
// BUONO: page.getByRole('button', { name: 'Salva' })
// BUONO: page.locator('[data-testid="save-btn"]')
// CATTIVO: page.locator('div > div:nth-child(3) > button')

// SEMPRE verificare stato dopo azione
await page.click('button:has-text("Salva")');
await expect(page.locator('.toast-success')).toBeVisible({ timeout: 5000 });

// SEMPRE screenshot automatico su errore
// Configurare in playwright.config.ts:
// use: { screenshot: 'only-on-failure' }
```

### Setup/Teardown
```javascript
test.beforeEach(async ({ page }) => {
  // Verifica che l'auth sia valida
  const token = await page.evaluate(() => localStorage.getItem('token'));
  if (!token) throw new Error('Auth non valida - rieseguire auth.setup.ts');
});

test.afterEach(async ({ page }, testInfo) => {
  // Screenshot automatico se test fallito
  if (testInfo.status !== 'passed') {
    await page.screenshot({
      path: `test-results/failures/${testInfo.title.replace(/\s/g, '_')}.png`,
      fullPage: true
    });
  }
});
```

### Attese Robuste
```javascript
// NON usare waitForTimeout (fragile, lento)
// CATTIVO: await page.waitForTimeout(3000);

// USARE attese su condizioni reali
// BUONO: await page.waitForSelector('table tbody tr');
// BUONO: await expect(page.locator('h1')).toContainText('Dipendenti');
// BUONO: await page.waitForResponse(resp => resp.url().includes('/api/v1/employees'));
```

---

## ESCLUSIONI TECNICHE (non per scelta ma per impossibilita)

| Cosa | Perche |
|------|--------|
| Email SMTP | Nessun mail server di test disponibile |
| Cross-browser (Firefox, Safari, Edge) | Solo Chromium installato nell'ambiente |
| Touch gesture reali | Nessun device fisico, solo simulazione viewport |
| Webhook delivery esterna | Nessun endpoint esterno per ricevere webhooks |
| Load/stress testing | Non e' test funzionale, richiede tool dedicati (k6, Artillery) |

**TUTTO IL RESTO E' INCLUSO. Nessuna esclusione per scelta.**

---

**Questo documento e' la tua bibbia. 81 pagine, 31 fasi, 100+ screenshot. Seguilo alla lettera o vattene.**
