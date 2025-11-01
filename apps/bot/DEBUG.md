# Debug Trade Ideas Not Appearing

## Vérifications à faire

1. **Vérifier que le bot est authentifié**
   - Regarder les logs du bot pour voir `🔐 Authentication successful`
   - Si erreur d'authentification, vérifier `AUTH_EMAIL` et `AUTH_PASSWORD` dans `.env`

2. **Vérifier les logs du bot**
   - Le bot devrait afficher `📊 [SYMBOL]: [SIDE] signal...`
   - Puis `✅ [SYMBOL]: Trade idea saved successfully`
   - Ou `✗ Failed to post trade idea for [SYMBOL]: Status: [STATUS], Error: [ERROR]`

3. **Vérifier les logs de l'API**
   - L'API devrait loguer `Trade idea created successfully` avec symbol, side, score, userId
   - Vérifier qu'il n'y a pas d'erreurs 500 ou 400

4. **Vérifier la base de données**
   ```sql
   SELECT * FROM trade_ideas ORDER BY created_at DESC LIMIT 10;
   ```
   - Vérifier que les trade ideas sont bien insérés

5. **Vérifier l'endpoint API**
   ```bash
   curl -X POST http://localhost:8080/v1/trade-ideas \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "exchange": "binance",
       "symbol": "BTCUSDT",
       "side": "BUY",
       "score": 0.75,
       "reason": "Test",
       "metadata": {"source": "test"}
     }'
   ```

6. **Vérifier les variables d'environnement du bot**
   - `API_BASE_URL` doit pointer vers l'API
   - `AUTH_EMAIL` et `AUTH_PASSWORD` doivent être valides
   - `ACCESS_TOKEN` ou `REFRESH_TOKEN` peuvent être fournis directement

## Problèmes courants

1. **Bot non authentifié**
   - Solution: Vérifier les credentials dans `.env`

2. **Token expiré**
   - Solution: Le bot devrait auto-refresh, mais vérifier les logs

3. **API non accessible**
   - Solution: Vérifier `API_BASE_URL` et que l'API tourne

4. **Erreurs de validation**
   - Solution: Vérifier les logs d'erreur dans la console du bot

