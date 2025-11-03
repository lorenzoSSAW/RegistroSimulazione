RegistroSimulazione - pacchetto finale Railway-ready

Istruzioni rapide:
1) Estrai ZIP
2) Crea repo GitHub e push dei file
3) Sign in su Railway -> New Project -> Deploy from GitHub
4) Crea servizio Postgres su Railway, copia DATABASE_URL come variabile d'ambiente
5) Deploy; poi esegui POST /api/seed con secret impostato in SEED_SECRET per popolare dati iniziali
