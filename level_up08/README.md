# LEVEL UP — atualização de experiência

## O que foi atualizado
- Corrigido o listener do seletor de importação: ele agora é delegado, pois o campo só existe depois que Configurações é renderizada. Isso evitava uma exceção durante a inicialização.
- Adicionado fallback visível para falhas de renderização, com botão de nova tentativa.
- Adicionadas preferências persistentes para sons, volume, sons de notificação, animações, intensidade e antecedência de lembretes.
- Adicionado módulo de efeitos sonoros sintetizados localmente com Web Audio API. O áudio só toca após interação e pode ser desligado.
- Adicionados avisos internos dispensáveis, tentativa de notificação nativa após permissão explícita e lembretes enquanto a página estiver aberta.
- Corrigida a função de data para usar a data local do dispositivo em vez de UTC.
- Adicionados manifest, ícones, cache offline básico e service worker com handlers de push recebida.
- Preservada a chave de dados existente `levelUpData_v1`; as novas preferências são mescladas com os padrões sem apagar o progresso.

## Como executar
Para desenvolvimento, use um servidor local em vez de abrir `index.html` com `file://`. Por exemplo, com Python instalado:

```bash
python -m http.server 8000
```

Depois abra `http://localhost:8000` na pasta do projeto. Para instalação real como PWA e testes em celulares, publique em HTTPS.

## Como testar
1. Abra o site e confira o Dashboard e o tutorial inicial.
2. Vá em Configurações → Notificações e experiência.
3. Clique em **Ativar / verificar** para pedir permissão ao navegador; a permissão nunca é solicitada automaticamente.
4. Clique em **Enviar notificação de teste**.
5. Em Experiência, teste o som, ajuste o volume e desligue/ligue sons e animações.
6. Crie uma atividade para hoje com horário futuro e teste a antecedência escolhida enquanto a página estiver aberta.
7. Conclua uma tarefa e confira o XP, a notificação visual e o som conforme as preferências.
8. Atualize a página e confirme que dados e preferências continuam presentes.

## Limitações importantes
- Lembretes por horário funcionam enquanto o site está aberto e o JavaScript está executando. O navegador pode suspender abas em segundo plano; timers não são garantia de entrega.
- **Notificações com o site totalmente fechado ainda não estão habilitadas por completo.** O service worker consegue exibir um evento `push` recebido, mas falta um serviço de envio, endpoint de inscrição, armazenamento de subscriptions e chaves VAPID. Não há servidor nem chaves privadas incluídos, e nenhuma chave privada deve ser colocada no frontend.
- Push remoto precisa ser configurado e publicado em HTTPS; compatibilidade varia entre navegador e sistema operacional. O suporte de PWA no iOS/Android/Windows também depende do navegador.
- O teste executado neste ambiente é estático/sintático; não equivale a teste visual em Chrome/Edge/Android nem valida notificações do sistema operacional.
