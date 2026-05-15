# Meu Caixa Mobile

Aplicativo oficial Expo do Meu Caixa Premium.

Este app nao substitui o sistema web. Ele abre a producao Next.js em uma WebView premium e adiciona recursos nativos:

- login persistente por cookies da WebView;
- push notifications via Expo;
- deep links para abrir telas internas;
- suporte a upload/camera dentro da WebView;
- tratamento offline e loading premium;
- abertura segura de WhatsApp, telefone, e-mail e Instagram fora da WebView.

## URL web principal

O app carrega:

```txt
https://meu-caixa-indol.vercel.app
```

Configure a mesma URL em:

- `mobile/.env`
- `mobile/eas.json`
- `mobile/app.json` em `expo.extra.webUrl`

## Desenvolvimento

```bash
cd mobile
npm install
npm run start
```

## Build Android

APK interno:

```bash
npm run build:apk
```

AAB de producao:

```bash
npm run build:android
```

## Build iOS

```bash
npm run build:ios
```

## Push notifications

O token Expo e gerado no app nativo e registrado no backend web autenticado por:

```txt
POST /api/push/register-token
```

O registro acontece dentro do contexto da WebView para reaproveitar a sessao/cookies do Supabase Auth. Se o usuario ainda nao estiver logado, a falha e ignorada e o app tenta novamente depois.

Para push em producao, rode `eas init` no diretorio `mobile` para preencher `expo.extra.eas.projectId` em `app.json`.

## Deep links

Esquema interno:

```txt
meucaixa://gestao/agenda
meucaixa://cliente?id=BARBEARIA_ID
```

Links HTTPS do dominio tambem sao aceitos:

```txt
https://meu-caixa-indol.vercel.app/gestao/agenda
```

Ao tocar em uma notificacao, o app usa `data.target_url` para navegar para a tela correta dentro da WebView.
