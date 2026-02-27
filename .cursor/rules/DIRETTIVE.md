# Direttive di Sviluppo - DCPD Shopify Theme

## Regole Generali

### Git e Versioning
- **Commit dopo ogni modifica**: Eseguire sempre commit e push dopo ogni modifica o creazione di file
- Usare messaggi di commit descrittivi in italiano con prefissi standard (feat:, fix:, refactor:, docs:, style:, chore:)

### Responsività
- **Il sito deve essere totalmente responsive**: Ogni sviluppo/modifica deve tenere conto della responsività su tutti i dispositivi
- Utilizzare breakpoint coerenti con il tema (750px per mobile/desktop)
- Testare sempre su viewport mobile e desktop

### Accessibilità
- Implementare attributi ARIA appropriati (role, aria-label, aria-describedby)
- Rispettare `prefers-reduced-motion` per le animazioni
- Garantire navigazione da tastiera per elementi interattivi
- Usare contrasti di colore adeguati

### Performance
- Utilizzare lazy loading per media e contenuti pesanti (IntersectionObserver)
- Caricare script con `defer` o `async`
- Ottimizzare per display Retina quando necessario

### Naming Convention
- Sections custom: prefisso `ms_` (es. `ms_rive-animation.liquid`)
- CSS/JS correlati: stesso nome della section senza prefisso (es. `rive-animation.css`)

## Risorse Utili

### Rive Animations
- Marketplace: https://rive.app/marketplace
- Documentazione Runtime Web: https://rive.app/docs/runtimes/web/web-js
