# PRD: Comissionamento por Colaboradores

**Documento de Especificação de Produto (Product Requirements Document)**
**Data:** 18/08/2026 | **Status:** Pronto para Design Doc | **Versão:** 1.1

## 1. Visão Geral e Objetivo
A funcionalidade de **Comissionamento por Colaboradores** gerencia o cálculo automático do valor devido aos profissionais (ex: barbeiros/cabeleireiros) no fechamento mensal. O sistema deve diferenciar a venda de **Produtos físicos** da prestação de **Serviços**, aplicando taxas distintas. O comissionamento de serviços possui uma regra de escalonamento (tiers) projetada para incentivar o aumento do volume de atendimentos.

## 2. Regras de Negócio (Core Logic)

### Regra 2.1 - Comissionamento de Produtos (Fixo)
Vendas de produtos físicos não entram no cálculo de escalonamento mensal.
*   **Taxa Aplicada:** **10%** fixos sobre o valor bruto da venda do produto.

### Regra 2.2 - Comissionamento de Serviços (Escalável / Tiered)
Serviços executados pelo colaborador entram em um acumulador de faturamento mensal bruto. A taxa de comissão a ser paga será definida de acordo com o volume total acumulado no fim do mês.

**Tabela de Faixas (Tiers) - Faturamento Bruto Mensal:**
*   **Tier 1 (Base):** € 0,00 até € 3.499,99 ➔ **45%**
*   **Tier 2:** € 3.500,00 até € 3.999,99 ➔ **50%**
*   **Tier 3:** € 4.000,00 até € 4.499,99 ➔ **52%**
*   **Tier 4:** € 4.500,00 até € 4.999,99 ➔ **54%**
*   **Tier 5:** € 5.000,00 até € 5.499,99 ➔ **56%**
*   **Tier 6:** € 5.500,00 até € 5.999,99 ➔ **58%**
*   **Tier 7 (Teto):** A partir de € 6.000,00 ➔ **60%**

*(Nota técnica: Intervalos tratam o limite inferior como inclusivo `>=` e superior como exclusivo `<`)*

### Regra 2.3 - Escalonamento Individual
O atingimento das faixas (tiers) é **100% individual**. O faturamento de um colaborador não interfere no percentual do outro. Cada profissional escala a sua própria taxa de comissão com base unicamente no montante de serviços que ele próprio executou.

### Regra 2.4 - Multiplicador Absoluto por Faixa (Efeito Retroativo)
O cálculo **não é progressivo (marginal)**. No fechamento do mês, o sistema identifica a faixa máxima atingida pelo colaborador e aplica a taxa dessa faixa sobre **todo o faturamento bruto mensal de serviços** gerado por ele.

### Regra 2.5 - Piso de Comissão Customizado (Garantia Mínima)
O sistema deve permitir configurar um "Piso de Comissão" (Base Rate Override) no perfil individual do colaborador. O motor de cálculo deve apurar a taxa baseada no faturamento real do mês e compará-la com o Piso do colaborador, aplicando sempre o **maior valor entre os dois**. Isso atende ao direito adquirido de colaboradores mais antigos, sem impedi-los de escalar suas comissões.

**Exemplos de Aceitação (Acceptance Criteria):**
*   **Cenário A (Normal):** Colaborador faturou € 3.500 no mês. Atingiu o Tier 2 (50%). Cálculo: € 3.500 * 50% = **€ 1.750,00**.
*   **Cenário B (Normal):** Colaborador faturou € 5.000 no mês. Atingiu o Tier 5 (56%). Cálculo: € 5.000 * 56% = **€ 2.800,00**.
*   **Cenário C (Uso do Piso):** Colaborador possui piso configurado de 50%. Faturou € 2.000 (Tier 1 - 45%). Prevalece o piso. Cálculo: € 2.000 * 50% = **€ 1.000,00**.
*   **Cenário D (Ultrapassando o Piso):** Colaborador possui piso de 50%. Faturou € 4.500 (Tier 4 - 54%). Prevalece a faixa alcançada. Cálculo: € 4.500 * 54% = **€ 2.430,00**.

## 3. Contratos de Dados e Dependências (Design by Contract)
Para permitir o desenvolvimento paralelo, **não é exigida a implementação prévia dos módulos completos de Produtos e Serviços**. O módulo de comissionamento assumirá que os dados chegarão via contrato (interface). 

Qualquer módulo externo que registre vendas deve injetar eventos no sistema de comissionamento contendo, no mínimo:
*   `employee_id` (Identificador do colaborador)
*   `item_type` (Enum: `SERVICE` ou `PRODUCT`)
*   `gross_value` (Valor bruto monetário da transação)
*   `transaction_date` (Data/hora da transação, para agrupar no mês correto)

*(Adicional: O perfil do colaborador na base de dados deverá conter a coluna opcional `guaranteed_commission_rate` para suportar a Regra 2.5).*

## 4. Casos de Uso (User Stories)
1.  **Como Gestor:** Quero que o sistema apure as comissões automaticamente no dia 1º de cada mês com base no mês anterior, para evitar erros de cálculo manual.
2.  **Como Gestor:** Quero poder configurar uma comissão mínima garantida para colaboradores específicos, garantindo direitos adquiridos sem prejudicar a meritocracia da escala.
3.  **Como Colaborador:** Quero visualizar um "termômetro" em tempo real no meu painel, mostrando quanto já faturei em serviços no mês e qual o valor faltante para eu atingir a próxima faixa (+2%), para me motivar a vender mais serviços.
4.  **Como Colaborador:** Quero ver o extrato discriminado mostrando o total ganho com Produtos (10%) e o total com Serviços (Faixa atingida), para entender a composição do meu pagamento.

## 5. Edge Cases (Tratamento de Exceções)
*   **Estornos/Cancelamentos:** Abatem diretamente do montante bruto do mês atual. Se o estorno rebaixar o faturamento para uma faixa inferior, a taxa recalculada será a da faixa menor.
*   **Descontos:** O faturamento bruto acumulado deve ser o valor efetivamente pago pelo cliente após aplicação de cupons/descontos.
*   **Precisão Monetária:** Exige uso rigoroso de tipos numéricos adequados (ex: `Decimal` em vez de `Float`) e arredondamento padrão bancário na exibição (duas casas decimais, em Euros €).
