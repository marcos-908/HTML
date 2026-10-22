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

## Correção do tutorial inicial (v5)
- Causa identificada: a inicialização usava `introDone` como critério para não mostrar a introdução. Essa flag também podia ficar `true` ao sair/interromper o tutorial, mesmo sem concluir a sequência; além disso, a mudança de chave de `v3/v4` para uma versão nova podia ignorar o estado antigo.
- A inicialização agora usa `completed === true` como único sinal de conclusão definitiva. Se o tutorial estiver em andamento, ele retoma a etapa salva; se não estiver concluído, a introdução começa automaticamente.
- A leitura migra com segurança os estados `levelUpTutorial_v1` a `levelUpTutorial_v4`, sem tocar em `levelUpData_v1` nem no progresso. Flags antigas `seen`/`introDone` não são tratadas como conclusão definitiva.
- A opção de rever tutorial continua disponível nas Configurações.

### Verificação do tutorial
- `node --check app.js`: aprovado.
- Verificações estáticas das transições de estado (primeira visita, conclusão, recarga, revisão manual e retomada após recarga durante a introdução): aprovadas por inspeção/validação do código.
- Limitação: não foi possível executar um navegador visual real neste ambiente; o teste ponta a ponta de cliques e DOM ainda precisa ser confirmado no navegador.
