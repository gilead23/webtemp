// AUTO-GENERATED from expression_language_guide.txt. Do not hand-edit.
// If you update the guide, regenerate this file.
export const expressionLanguageHelpHtml = `<hr />

<h1 id="expression-language-full-reference">Expression Language — Full Reference</h1>

<h2 id="0-core-assumptions-read-me-once">0) Core assumptions (read me once)</h2>

<ul>
<li><strong>Index type:</strong> <code>Int64Index[YYYYMMDD]</code> shared across all series.</li>
<li><strong>Operands:</strong> Scalars (float/int/bool/str) or Series aligned to the canonical index.</li>
<li><strong>Flags:</strong> Produce boolean Series.</li>
<li><strong>Events:</strong> Use <em>tradable</em> semantics and integer math (bars-since/until = positional distances).</li>
<li><strong>Parentheses:</strong> Fully supported and highest precedence.</li>
</ul>

<hr />

<h2 id="1-lexical-tokens-token-list">1) Lexical tokens (token list)</h2>

<h3 id="1-1-literals">1.1 Literals</h3>

<ul>
<li><strong>Integer:</strong> <code>0</code>, <code>1</code>, <code>42</code>, <code>20251024</code></li>
<li><strong>Float:</strong> <code>0.0</code>, <code>3.14</code>, <code>.5</code>, <code>1e-3</code></li>
<li><strong>Boolean:</strong> <code>true</code>, <code>false</code> (case-insensitive also accepted: <code>TRUE</code>, <code>FALSE</code>)</li>
<li><strong>String:</strong> double quotes or single quotes</li>
</ul>

<ul>
<li><code>&quot;EPS&quot;</code>, <code>&#x27;surprise_pct&#x27;</code>, <code>&quot;up&quot;</code></li>
<li>Escape <code>\&quot;</code> or <code>\&#x27;</code> inside strings.</li>
</ul>

<h3 id="1-2-identifiers">1.2 Identifiers</h3>

<ul>
<li><strong>Unqualified:</strong> <code>close</code>, <code>mfi</code>, <code>earnings</code>, <code>bb_upper</code></li>
<li><strong>Qualified:</strong> <code>domain.dataset</code>, <code>domain.dataset.field</code>, <code>flag.FlagName</code></li>
<li><strong>Rules:</strong> <code>[A-Za-z_][A-Za-z0-9_]*</code> for each path segment.</li>
</ul>

<h3 id="1-3-operators-punctuation">1.3 Operators &amp; punctuation</h3>

<ul>
<li><strong>Arithmetic:</strong> <code>+  -  *  /  %  ^</code></li>
<li><strong>Comparisons:</strong> <code>=  !=  &lt;  &lt;=  &gt;  &gt;=</code></li>
<li><strong>Logical:</strong> <code>and  or  not</code> (also <code>&amp;&amp;</code>, <code>||</code>, <code>!</code>)</li>
<li><strong>Membership:</strong> <code>in</code>, <code>not in</code></li>
<li><strong>Range literal:</strong> <code>..</code> (inclusive)</li>
<li><strong>Delimiters:</strong> <code>(</code> <code>)</code> <code>,</code> <code>[</code> <code>]</code> <code>{</code> <code>}</code> <code>.</code></li>
</ul>

<h3 id="1-4-keywords-reserved">1.4 Keywords (reserved)</h3>

<p><code>and or not in true false flag ohlc indicator event econ cross week_of_year week_of_month month quarter</code></p>

<blockquote>Note: You can still call functions named like the keywords when they’re qualified (e.g., \`event.earnings.days_since()\`).</blockquote>

<hr />

<h2 id="2-grammar-bnf">2) Grammar (BNF)</h2>

<p>Whitespace is insignificant except inside string literals.</p>

<pre class="code"><code data-lang="">
expr            := or_expr

or_expr         := and_expr { OR and_expr }
AND             := &quot;and&quot; | &quot;AND&quot; | &quot;&amp;&amp;&quot;
OR              := &quot;or&quot;  | &quot;OR&quot;  | &quot;||&quot;
NOT             := &quot;not&quot; | &quot;NOT&quot; | &quot;!&quot;

and_expr        := not_expr { AND not_expr }
not_expr        := [ NOT ] cmp_expr

cmp_expr        := sum_expr { compare_op sum_expr
                            | IN set_expr
                            | NOT IN set_expr }
compare_op      := &quot;=&quot; | &quot;!=&quot; | &quot;&lt;&quot; | &quot;&lt;=&quot; | &quot;&gt;&quot; | &quot;&gt;=&quot;
IN              := &quot;in&quot; | &quot;IN&quot;

sum_expr        := mul_expr { (&quot;+&quot;|&quot;-&quot;) mul_expr }
mul_expr        := pow_expr { (&quot;*&quot;|&quot;/&quot;|&quot;%&quot;) pow_expr }
pow_expr        := unary_num { &quot;^&quot; unary_num }
unary_num       := [ &quot;+&quot; | &quot;-&quot; ] postfix

postfix         := primary { postfix_op }
postfix_op      := &quot;.&quot; ident call_suffix?
                 | &quot;[&quot; slice_args &quot;]&quot;     // reserved for future table slicing

primary         := literal
                 | ident ns_suffix? call_suffix?
                 | &quot;(&quot; expr &quot;)&quot;

ns_suffix       := &quot;.&quot; ident ( &quot;.&quot; ident )?   // domain.dataset[.field]

call_suffix     := &quot;(&quot; arg_list? &quot;)&quot;
arg_list        := (named_arg | expr) { &quot;,&quot; (named_arg | expr) }
named_arg       := ident &quot;=&quot; expr

set_expr        := &quot;{&quot; set_list &quot;}&quot; | range
set_list        := expr { &quot;,&quot; expr }
range           := sum_expr &quot;..&quot; sum_expr

literal         := number | string | boolean
number          := integer | float
boolean         := TRUE | FALSE
integer         := DIGITS
float           := DIGITS &quot;.&quot; DIGITS [EXP] | &quot;.&quot; DIGITS [EXP] | DIGITS EXP
EXP             := (&quot;e&quot; | &quot;E&quot;) [&quot;+&quot;|&quot;-&quot;] DIGITS
</code></pre>

<p><strong>Notes</strong></p>

<ul>
<li>Parentheses <code>(...)</code> group expressions and override precedence.</li>
<li><code>x in 20..30</code> is inclusive range; same as <code>between(x, 20, 30)</code>.</li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>between(close(), 11, 14)</code></p>

<p>Output: 20240102    False 20240103    True 20240104    True 20240105    True 20240108    True 20240109    False 20240110    True 20240111    False</p>

<p>Explanation: True where Close is within [11,14].</p>


<hr />

<h2 id="3-operator-precedence-high-low">3) Operator precedence (high → low)</h2>

<p>1. <code>()</code> (grouping) 2. unary <code>-</code>, <code>+</code>, <code>not/!</code> 3. <code>^</code> (power) 4. <code>*</code>, <code>/</code>, <code>%</code> 5. <code>+</code>, <code>-</code> 6. comparisons <code>= != &lt; &lt;= &gt; &gt;=</code>, membership <code>in / not in</code> 7. <code>and</code> 8. <code>or</code></p>

<blockquote>In practice, **always parenthesize** complex mixed boolean expressions.</blockquote>

<hr />

<h2 id="4-types-broadcasting">4) Types &amp; broadcasting</h2>

<ul>
<li><strong>Scalar</strong> (int/float/bool/str) vs <strong>Series</strong> (aligned to canonical index).</li>
<li>Arithmetic and comparisons are <strong>elementwise</strong>. Scalars broadcast to Series.</li>
<li>Membership/range produce boolean Series.</li>
<li><code>range(series, offset, length)</code> selects a window of bars; wrap with aggregates like <code>max()</code>, <code>min()</code>, <code>mean()</code>.</li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>max(range(close(), 1, 3))</code></p>

<p>Output: 20240102    NaN 20240103    10.5 20240104    11.5 20240105    12.2 20240108    12.2 20240109    13.4 20240110    14.2 20240111    14.2</p>

<p>Explanation: Maximum of close from 1 to 3 bars ago.</p>


<ul>
<li>Aggregates (<code>max</code>, <code>min</code>, <code>mean</code>, <code>sum</code>, <code>stdev</code>, <code>median</code>, <code>count</code>, <code>argmax</code>, <code>argmin</code>) reduce a range window to a per-bar scalar.</li>
<li>Boolean aggregates (<code>any</code>, <code>all</code>) reduce a boolean range to a per-bar bool.</li>
<li>Transforms (<code>change</code>, <code>pct_change</code>, <code>zscore</code>, <code>slope</code>, <code>rank</code>, <code>correlation</code>) produce series from series.</li>
</ul>

<hr />

<h2 id="5-namespacing-resolution">5) Namespacing &amp; resolution</h2>

<ul>
<li>Short names resolve via defaults:</li>
</ul>

<ul>
<li><code>close()</code> → <code>ohlc.bars.close()</code></li>
<li><code>mfi(14)</code> → <code>indicator.mfi(n=14)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (High): 20240102    11.0 20240103    12.0 20240104    13.0 20240105    12.0 20240108    14.0 20240109    15.0 20240110    14.0 20240111    16.0</p>

<p>Input (Low): 20240102    9.0 20240103    10.0 20240104    11.0 20240105    10.0 20240108    12.0 20240109    13.0 20240110    12.0 20240111    14.0</p>

<p>Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3</p>

<p>Input (Volume): 20240102    100.0 20240103    120.0 20240104    130.0 20240105    110.0 20240108    150.0 20240109    160.0 20240110    140.0 20240111    180.0 Expression: <code>mfi(window=3)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    74.0999 20240105    70.5587 20240108    74.4617 20240109    77.6667 20240110    69.8169 20240111    73.1403</p>

<p>Explanation: MFI uses typical price and volume; bounded 0–100; warmup until 3 bars.</p>

<ul>
<li><code>earnings.days_since()</code> → <code>event.earnings.days_since()</code></li>
<li>Fully qualify to disambiguate:</li>
</ul>

<ul>
<li><code>indicator.bollinger.upper(n=20,k=2)</code></li>
<li><code>flag.VMACDCrossoverV2(direction=&quot;up&quot;)</code></li>
</ul>

<p>Resolution order: <code>flag.*</code> > exact <code>domain.dataset(.field)</code> > domain defaults table. Unknown symbols raise <code>E_UNKNOWN_ID</code>.</p>

<hr />

<h2 id="6-built-in-functions-by-category">6) Built-in functions (by category)</h2>

<h3 id="6-1-ohlc">6.1 OHLC</h3>

<ul>
<li><code>open()</code>, <code>high()</code>, <code>low()</code>, <code>close()</code>, <code>vwap()</code>, <code>volume()</code></li>
</ul>
<p><strong>Return:</strong> numeric Series (float64 or int64). <strong>Example:</strong> <code>close() &gt; open()</code></p>

<h3 id="6-2-indicators">6.2 Indicators</h3>

<ul>
<li><strong>Moving averages &amp; smoothing</strong></li>
<li><code>sma(*, window=20, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>sma(window=3)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    11.4 20240105    11.6 20240108    12.2333 20240109    12.9 20240110    13.5667 20240111    14.2</p>

<p>Explanation: Mean of last 3 closes; first 2 bars are NaN.</p>

<ul>
<li><code>ema(*, span=10, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>ema(span=3)</code></p>

<p>Output: 20240102    10.5 20240103    11.0 20240104    11.6 20240105    11.35 20240108    12.375 20240109    13.2875 20240110    13.1937 20240111    14.2469</p>

<p>Explanation: Exponential weighting (alpha=2/(3+1)=0.5); starts immediately.</p>

<ul>
<li><code>wma(*, window=20, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>wma(window=3)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    11.6833 20240105    11.5333 20240108    12.4333 20240109    13.4167 20240110    13.5167 20240111    14.3833</p>

<p>Explanation: Linearly weighted mean with weights 1,2,3; first 2 bars NaN.</p>

<ul>
<li><code>vwma(*, window=20, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3</p>

<p>Input (Volume): 20240102    100.0 20240103    120.0 20240104    130.0 20240105    110.0 20240108    150.0 20240109    160.0 20240110    140.0 20240111    180.0 Expression: <code>vwma(window=3)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    11.4743 20240105    11.6306 20240108    12.3513 20240109    13.1024 20240110    13.5911 20240111    14.2917</p>

<p>Explanation: Weighted average of Close by Volume over last 3 bars.</p>

<ul>
<li><code>alma(*, window=9, column=&#x27;Close&#x27;, offset=0.85, sigma=6.0)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>alma(window=3, offset=0.85, sigma=6.0)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    11.9792 20240105    11.4412 20240108    12.6857 20240109    13.9447 20240110    13.4409 20240111    14.6169</p>

<p>Explanation: Gaussian-weighted moving average; small window for example.</p>

<ul>
<li><code>zlema(*, window=20, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>zlema(window=3)</code></p>

<p>Output: 20240102    NaN 20240103    12.5 20240104    12.7 20240105    11.35 20240108    13.525 20240109    14.2625 20240110    13.1312 20240111    15.3156</p>

<p>Explanation: Zero-lag EMA using a lag-adjusted series; starts immediately.</p>

<ul>
<li><code>dema(*, window=20, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>dema(window=3)</code></p>

<p>Output: 20240102    10.5 20240103    11.25 20240104    12.025 20240105    11.4375 20240108    12.9313 20240109    14.0219 20240110    13.5141 20240111    14.9336</p>

<p>Explanation: 2*EMA - EMA(EMA); reduces lag vs EMA.</p>

<ul>
<li><code>tema(*, window=20, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>tema(window=3)</code></p>

<p>Output: 20240102    10.5 20240103    11.375 20240104    12.175 20240105    11.3438 20240108    13.1188 20240109    14.2047 20240110    13.3984 20240111    15.059</p>

<p>Explanation: Triple EMA combination; reduces lag further.</p>

<ul>
<li><code>trima(*, window=20, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>trima(window=3)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    11.425 20240105    11.75 20240108    11.95 20240109    13.025 20240110    13.725 20240111    13.925</p>

<p>Explanation: Triangular MA (SMA of SMA); needs warmup.</p>

<ul>
<li><code>hma(*, window=20, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>hma(window=4)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    NaN 20240105    NaN 20240108    12.4856 20240109    14.1467 20240110    14.0044 20240111    14.4833</p>

<p>Explanation: Hull MA combines WMAs; window reduced for readability.</p>

<ul>
<li><code>lsma(*, window=20, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>lsma(window=3)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    12.25 20240105    11.4 20240108    12.8333 20240109    14.45 20240110    13.4167 20240111    14.75</p>

<p>Explanation: Least-squares fit over last 3 points; returns fitted last value.</p>

<ul>
<li><code>kama(*, window=10, fast=2, slow=30, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>kama(window=3, fast=2, slow=5)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    NaN 20240105    11.1 20240108    11.6473 20240109    12.2654 20240110    12.4675 20240111    13.1415</p>

<p>Explanation: Adaptive MA based on efficiency ratio; small parameters for example.</p>

<ul>
<li><code>lwma(*, window=20, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>lwma(window=3)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    11.6833 20240105    11.5333 20240108    12.4333 20240109    13.4167 20240110    13.5167 20240111    14.3833</p>

<p>Explanation: Linear weighted MA; same as wma for this engine.</p>


<ul>
<li><strong>Oscillators &amp; momentum</strong></li>
<li><code>rsi(*, window=14, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>rsi(window=3)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    NaN 20240105    60.7143 20240108    73.1707 20240109    73.8095 20240110    73.8095 20240111    73.1707</p>

<p>Explanation: RSI over 3 bars; bounded 0–100; warmup until 3 bars.</p>

<ul>
<li><code>mfi(*, window=14)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (High): 20240102    11.0 20240103    12.0 20240104    13.0 20240105    12.0 20240108    14.0 20240109    15.0 20240110    14.0 20240111    16.0</p>

<p>Input (Low): 20240102    9.0 20240103    10.0 20240104    11.0 20240105    10.0 20240108    12.0 20240109    13.0 20240110    12.0 20240111    14.0</p>

<p>Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3</p>

<p>Input (Volume): 20240102    100.0 20240103    120.0 20240104    130.0 20240105    110.0 20240108    150.0 20240109    160.0 20240110    140.0 20240111    180.0 Expression: <code>mfi(window=3)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    74.0999 20240105    70.5587 20240108    74.4617 20240109    77.6667 20240110    69.8169 20240111    73.1403</p>

<p>Explanation: MFI uses typical price and volume; bounded 0–100; warmup until 3 bars.</p>

<ul>
<li><code>macd(*, fast=12, slow=26, signal=9, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>macd(fast=3, slow=5, signal=2)</code></p>

<p>Output (macd_line): 20240102    0.0 20240103    0.1667 20240104    0.3111 20240105    0.1241 20240108    0.4244 20240109    0.5871 20240110    0.3601 20240111    0.5911</p>

<p>Output (signal): 20240102    0.0 20240103    0.1111 20240104    0.2444 20240105    0.1642 20240108    0.3377 20240109    0.5039 20240110    0.4081 20240111    0.5301</p>

<p>Output (hist): 20240102    0.0 20240103    0.0556 20240104    0.0667 20240105    -0.0401 20240108    0.0867 20240109    0.0831 20240110    -0.0479 20240111    0.061</p>

<p>Explanation: MACD line = EMA_fast − EMA_slow; signal = EMA(signal) of MACD; hist=line−signal.</p>

<ul>
<li><code>apo(*, fast=12, slow=26, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>apo(fast=3, slow=5)</code></p>

<p>Output: 20240102    0.0 20240103    0.1667 20240104    0.3111 20240105    0.1241 20240108    0.4244 20240109    0.5871 20240110    0.3601 20240111    0.5911</p>

<p>Explanation: APO is EMA_fast − EMA_slow in price units.</p>

<ul>
<li><code>ppo(*, fast=12, slow=26, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>ppo(fast=3, slow=5)</code></p>

<p>Output: 20240102    0.0 20240103    1.5385 20240104    2.7559 20240105    1.1052 20240108    3.5511 20240109    4.6226 20240110    2.8062 20240111    4.3289</p>

<p>Explanation: PPO is 100*(EMA_fast−EMA_slow)/EMA_slow; percent units.</p>

<ul>
<li><code>momentum(*, window=10, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>momentum(window=2)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    1.7 20240105    -0.4 20240108    1.2 20240109    3.1 20240110    -0.3 20240111    1.1</p>

<p>Explanation: Difference Close − Close@2; first 2 bars NaN.</p>

<ul>
<li><code>roc(*, window=10, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>roc(window=2)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    16.1905 20240105    -3.4783 20240108    9.8361 20240109    27.9279 20240110    -2.2388 20240111    7.7465</p>

<p>Explanation: Percent change over 2 bars; first 2 bars NaN.</p>

<ul>
<li><code>rocp(*, window=10, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>rocp(window=2)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    0.1619 20240105    -0.0348 20240108    0.0984 20240109    0.2793 20240110    -0.0224 20240111    0.0775</p>

<p>Explanation: Fractional change over 2 bars; first 2 bars NaN.</p>

<ul>
<li><code>rocr(*, window=10, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>rocr(window=2)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    1.1619 20240105    0.9652 20240108    1.0984 20240109    1.2793 20240110    0.9776 20240111    1.0775</p>

<p>Explanation: Ratio Close/Close@2; first 2 bars NaN.</p>

<ul>
<li><code>trix(*, window=15, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>trix(window=3)</code></p>

<p>Output: 20240102    NaN 20240103    1.1905 20240104    2.5882 20240105    1.6628 20240108    3.3277 20240109    4.8171 20240110    3.6323 20240111    4.5132</p>

<p>Explanation: Triple EMA then 1-bar percent change; early bars NaN.</p>

<ul>
<li><code>cmo(*, window=14, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>cmo(window=3)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    NaN 20240105    21.4286 20240108    46.3415 20240109    47.619 20240110    47.619 20240111    46.3415</p>

<p>Explanation: CMO=100*(sum(up)-sum(down))/(sum(up)+sum(down)).</p>

<ul>
<li><code>cci(*, window=20)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (High): 20240102    11.0 20240103    12.0 20240104    13.0 20240105    12.0 20240108    14.0 20240109    15.0 20240110    14.0 20240111    16.0</p>

<p>Input (Low): 20240102    9.0 20240103    10.0 20240104    11.0 20240105    10.0 20240108    12.0 20240109    13.0 20240110    12.0 20240111    14.0</p>

<p>Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>cci(window=3)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    NaN 20240105    NaN 20240108    88.785 20240109    95.5823 20240110    -27.4194 20240111    75.6098</p>

<p>Explanation: CCI uses typical price deviation from mean scaled by 0.015*mean deviation.</p>

<ul>
<li><code>williams_r(*, window=14)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (High): 20240102    11.0 20240103    12.0 20240104    13.0 20240105    12.0 20240108    14.0 20240109    15.0 20240110    14.0 20240111    16.0</p>

<p>Input (Low): 20240102    9.0 20240103    10.0 20240104    11.0 20240105    10.0 20240108    12.0 20240109    13.0 20240110    12.0 20240111    14.0</p>

<p>Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>williams_r(window=3)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    -20.0 20240105    -63.3333 20240108    -15.0 20240109    -16.0 20240110    -63.3333 20240111    -17.5</p>

<p>Explanation: Williams %R=-100*(HH−Close)/(HH−LL).</p>

<ul>
<li><code>stoch(*, k_window=14, d_window=3, smooth_k=1, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (High): 20240102    11.0 20240103    12.0 20240104    13.0 20240105    12.0 20240108    14.0 20240109    15.0 20240110    14.0 20240111    16.0</p>

<p>Input (Low): 20240102    9.0 20240103    10.0 20240104    11.0 20240105    10.0 20240108    12.0 20240109    13.0 20240110    12.0 20240111    14.0</p>

<p>Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>stoch(k_window=3, d_window=2)</code></p>

<p>Output (%K): 20240102    NaN 20240103    NaN 20240104    80.0 20240105    36.6667 20240108    85.0 20240109    84.0 20240110    36.6667 20240111    82.5</p>

<p>Output (%D): 20240102    NaN 20240103    NaN 20240104    NaN 20240105    58.3333 20240108    60.8333 20240109    84.5 20240110    60.3333 20240111    59.5833</p>

<p>Explanation: Stochastic %K compares Close to recent range; %D is SMA of %K.</p>

<ul>
<li><code>stoch_rsi(*, rsi_window=14, stoch_window=14, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>stoch_rsi(rsi_window=3, stoch_window=3)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    NaN 20240105    NaN 20240108    NaN 20240109    100.0 20240110    100.0 20240111    0.0</p>

<p>Explanation: Compute RSI then stochastic normalize RSI over last 3 bars.</p>

<ul>
<li><code>ultimate_oscillator(*, short=7, medium=14, long=28)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (High): 20240102    11.0 20240103    12.0 20240104    13.0 20240105    12.0 20240108    14.0 20240109    15.0 20240110    14.0 20240111    16.0</p>

<p>Input (Low): 20240102    9.0 20240103    10.0 20240104    11.0 20240105    10.0 20240108    12.0 20240109    13.0 20240110    12.0 20240111    14.0</p>

<p>Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>ultimate_oscillator(short=2, medium=3, long=4)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    NaN 20240105    58.0375 20240108    66.1824 20240109    68.4326 20240110    58.5593 20240111    64.7977</p>

<p>Explanation: Weighted average of buying pressure/true range over 3 windows.</p>

<ul>
<li><code>adx(*, window=14)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (High): 20240102    11.0 20240103    12.0 20240104    13.0 20240105    12.0 20240108    14.0 20240109    15.0 20240110    14.0 20240111    16.0</p>

<p>Input (Low): 20240102    9.0 20240103    10.0 20240104    11.0 20240105    10.0 20240108    12.0 20240109    13.0 20240110    12.0 20240111    14.0</p>

<p>Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>adx(window=3)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    NaN 20240105    NaN 20240108    61.1111 20240109    44.4444 20240110    50.0 20240111    50.0</p>

<p>Explanation: ADX from smoothed directional movement; small window for example.</p>

<ul>
<li><code>adxr(*, window=14)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (High): 20240102    11.0 20240103    12.0 20240104    13.0 20240105    12.0 20240108    14.0 20240109    15.0 20240110    14.0 20240111    16.0</p>

<p>Input (Low): 20240102    9.0 20240103    10.0 20240104    11.0 20240105    10.0 20240108    12.0 20240109    13.0 20240110    12.0 20240111    14.0</p>

<p>Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>adxr(window=3)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    NaN 20240105    NaN 20240108    NaN 20240109    NaN 20240110    NaN 20240111    55.5556</p>

<p>Explanation: ADXR = (ADX + ADX shifted by window)/2.</p>


<ul>
<li><strong>Volatility &amp; bands</strong></li>
<li><code>atr(*, window=14, percent=False)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (High): 20240102    11.0 20240103    12.0 20240104    13.0 20240105    12.0 20240108    14.0 20240109    15.0 20240110    14.0 20240111    16.0</p>

<p>Input (Low): 20240102    9.0 20240103    10.0 20240104    11.0 20240105    10.0 20240108    12.0 20240109    13.0 20240110    12.0 20240111    14.0</p>

<p>Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>atr(window=3)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    2.0 20240105    2.0667 20240108    2.3667 20240109    2.3667 20240110    2.3667 20240111    2.3667</p>

<p>Explanation: ATR is mean True Range over last 3 bars.</p>

<ul>
<li><code>sigma(*, n=20, mode=&#x27;pct&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>sigma(n=3, mode=&#x27;pct&#x27;)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    NaN 20240105    0.0986 20240108    0.1487 20240109    0.1487 20240110    0.1424 20240111    0.123</p>

<p>Explanation: Rolling std dev of percent returns over 3 bars.</p>

<ul>
<li><code>zscore(*, n=20, mode=&#x27;pct&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>zscore(n=3, mode=&#x27;pct&#x27;)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    NaN 20240105    -1.137 20240108    0.9947 20240109    0.0053 20240110    -0.9877 20240111    0.9585</p>

<p>Explanation: Z-score of percent returns: (x-mean)/std over 3 bars.</p>

<ul>
<li><code>boll(*, window=20, k=2.0, mode=&#x27;sma&#x27;, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>boll(window=3, k=2.0)</code></p>

<p>Output (mid): 20240102    NaN 20240103    NaN 20240104    11.4 20240105    11.6 20240108    12.2333 20240109    12.9 20240110    13.5667 20240111    14.2</p>

<p>Output (upper): 20240102    NaN 20240103    NaN 20240104    13.1088 20240105    12.7136 20240108    14.5341 20240109    16.1187 20240110    14.7039 20240111    16.4</p>

<p>Output (lower): 20240102    NaN 20240103    NaN 20240104    9.6912 20240105    10.4864 20240108    9.9326 20240109    9.6813 20240110    12.4294 20240111    12.0</p>

<p>Explanation: Mid=rolling mean; bands are ±2*rolling std.</p>

<ul>
<li><code>bb_mid(window=20, k=2.0, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>bb_mid(window=3)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    11.4 20240105    11.6 20240108    12.2333 20240109    12.9 20240110    13.5667 20240111    14.2</p>

<p>Explanation: Bollinger mid line equals rolling mean.</p>

<ul>
<li><code>bb_upper(window=20, k=2.0, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>bb_upper(window=3, k=2.0)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    13.1088 20240105    12.7136 20240108    14.5341 20240109    16.1187 20240110    14.7039 20240111    16.4</p>

<p>Explanation: Upper band = mid + k*std.</p>

<ul>
<li><code>bb_lower(window=20, k=2.0, column=&#x27;Close&#x27;)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>bb_lower(window=3, k=2.0)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    9.6912 20240105    10.4864 20240108    9.9326 20240109    9.6813 20240110    12.4294 20240111    12.0</p>

<p>Explanation: Lower band = mid − k*std.</p>


<ul>
<li><strong>Volume/flow</strong></li>
<li><code>obv()</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3</p>

<p>Input (Volume): 20240102    100.0 20240103    120.0 20240104    130.0 20240105    110.0 20240108    150.0 20240109    160.0 20240110    140.0 20240111    180.0 Expression: <code>obv()</code></p>

<p>Output: 20240102    0.0 20240103    120.0 20240104    250.0 20240105    140.0 20240108    290.0 20240109    450.0 20240110    310.0 20240111    490.0</p>

<p>Explanation: OBV cumulates volume with sign of close change.</p>

<ul>
<li><code>cmf(*, window=20)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (High): 20240102    11.0 20240103    12.0 20240104    13.0 20240105    12.0 20240108    14.0 20240109    15.0 20240110    14.0 20240111    16.0</p>

<p>Input (Low): 20240102    9.0 20240103    10.0 20240104    11.0 20240105    10.0 20240108    12.0 20240109    13.0 20240110    12.0 20240111    14.0</p>

<p>Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3</p>

<p>Input (Volume): 20240102    100.0 20240103    120.0 20240104    130.0 20240105    110.0 20240108    150.0 20240109    160.0 20240110    140.0 20240111    180.0 Expression: <code>cmf(window=3)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    0.3886 20240105    0.2694 20240108    0.2487 20240109    0.2452 20240110    0.2356 20240111    0.2083</p>

<p>Explanation: CMF sums money flow volume / volume over window.</p>

<ul>
<li><code>accumulation_distribution()</code></li>
</ul>

<p><strong>Worked Example</strong> Input (High): 20240102    11.0 20240103    12.0 20240104    13.0 20240105    12.0 20240108    14.0 20240109    15.0 20240110    14.0 20240111    16.0</p>

<p>Input (Low): 20240102    9.0 20240103    10.0 20240104    11.0 20240105    10.0 20240108    12.0 20240109    13.0 20240110    12.0 20240111    14.0</p>

<p>Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3</p>

<p>Input (Volume): 20240102    100.0 20240103    120.0 20240104    130.0 20240105    110.0 20240108    150.0 20240109    160.0 20240110    140.0 20240111    180.0 Expression: <code>accumulation_distribution()</code></p>

<p>Output: 20240102    50.0 20240103    110.0 20240104    136.0 20240105    147.0 20240108    207.0 20240109    239.0 20240110    253.0 20240111    307.0</p>

<p>Explanation: AD line is cumulative money flow volume.</p>

<ul>
<li><code>chaikin_osc(*, fast=3, slow=10)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (High): 20240102    11.0 20240103    12.0 20240104    13.0 20240105    12.0 20240108    14.0 20240109    15.0 20240110    14.0 20240111    16.0</p>

<p>Input (Low): 20240102    9.0 20240103    10.0 20240104    11.0 20240105    10.0 20240108    12.0 20240109    13.0 20240110    12.0 20240111    14.0</p>

<p>Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3</p>

<p>Input (Volume): 20240102    100.0 20240103    120.0 20240104    130.0 20240105    110.0 20240108    150.0 20240109    160.0 20240110    140.0 20240111    180.0 Expression: <code>chaikin_osc(fast=2, slow=3)</code></p>

<p>Output: 20240102    0.0 20240103    10.0 20240104    12.6667 20240105    10.7222 20240108    16.8241 20240109    17.5664 20240110    14.168 20240111    17.8789</p>

<p>Explanation: Chaikin oscillator = EMA_fast(AD) − EMA_slow(AD).</p>

<ul>
<li><code>accumulation_distribution_oscillator(*, fast=3, slow=10)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (High): 20240102    11.0 20240103    12.0 20240104    13.0 20240105    12.0 20240108    14.0 20240109    15.0 20240110    14.0 20240111    16.0</p>

<p>Input (Low): 20240102    9.0 20240103    10.0 20240104    11.0 20240105    10.0 20240108    12.0 20240109    13.0 20240110    12.0 20240111    14.0</p>

<p>Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3</p>

<p>Input (Volume): 20240102    100.0 20240103    120.0 20240104    130.0 20240105    110.0 20240108    150.0 20240109    160.0 20240110    140.0 20240111    180.0 Expression: <code>accumulation_distribution_oscillator(fast=2, slow=3)</code></p>

<p>Output: 20240102    0.0 20240103    10.0 20240104    12.6667 20240105    10.7222 20240108    16.8241 20240109    17.5664 20240110    14.168 20240111    17.8789</p>

<p>Explanation: Alias of Chaikin oscillator on AD line.</p>


<p>Examples:</p>

<pre class="code"><code data-lang="">
rsi(window=14) &lt; 30
close() &gt; bb_upper(window=20, k=2.0)
crosses_over(ema(span=12), ema(span=26))
</code></pre>


<h3 id="6-3-range-aggregates-transforms">6.3 Range, aggregates &amp; transforms</h3>

<p>The expression language uses a composable <code>range</code> → <code>aggregate</code> pattern for windowed computations, plus standalone transforms for series-to-series operations.</p>

<h4>Range function</h4>
<ul>
<li><code>range(series, offset, length)</code> — select a window of bars. <code>offset=0</code> includes today, <code>offset=1</code> starts at yesterday. <code>length</code> is the number of bars in the window.</li>
</ul>

<h4>Aggregate functions</h4>
<p>These reduce a range window (or the full expanding history if no range) to a per-bar value:</p>
<ul>
<li><code>max(range(...))</code>, <code>min(range(...))</code>, <code>mean(range(...))</code>, <code>sum(range(...))</code></li>
<li><code>stdev(range(...))</code>, <code>median(range(...))</code>, <code>count(range(...))</code></li>
<li><code>argmax(range(...))</code> — bars since the max in the window (0 = most recent bar)</li>
<li><code>argmin(range(...))</code> — bars since the min in the window</li>
<li><code>any(range(bool_series, ...))</code> — true if any bar in the window is true</li>
<li><code>all(range(bool_series, ...))</code> — true if all bars in the window are true</li>
</ul>

<p><strong>Examples</strong></p>
<pre class="code"><code data-lang="">
max(range(close(), 1, 10))          // highest close in last 10 bars (excluding today)
min(range(low(), 0, 20))            // lowest low in last 20 bars (including today)
mean(range(volume(), 0, 5))         // average volume over last 5 bars
any(range(rsi(14) > 70, 1, 20))    // was RSI overbought any day in last 20?
all(range(close() > sma(50), 1, 5)) // above 50-SMA every day for 5 days?
argmax(range(high(), 0, 20))        // how many bars ago was the 20-day high?
</code></pre>

<h4>Transform functions</h4>
<p>Series-to-series operations (no range needed):</p>
<ul>
<li><code>change(series, n)</code> — absolute change: value minus value n bars ago</li>
<li><code>pct_change(series, n)</code> — fractional change: (current / previous) - 1</li>
<li><code>zscore(series, window)</code> — rolling z-score: (value - rolling_mean) / rolling_std</li>
<li><code>slope(series, window)</code> — linear regression slope over rolling window</li>
<li><code>rank(series, window)</code> — percentile rank of current value in rolling window (0..1)</li>
<li><code>correlation(series_a, series_b, window)</code> — rolling Pearson correlation</li>
</ul>

<p><strong>Examples</strong></p>
<pre class="code"><code data-lang="">
change(close(), 5) > 0               // close up vs 5 bars ago
pct_change(volume(), 1) > 0.5        // volume up 50%+ vs yesterday
zscore(close(), 20) > 2              // close 2+ std devs above 20-day mean
slope(close(), 10) > 0               // 10-bar uptrend
slope(mean(range(close(), 0, 10)), 5) // slope of 10-bar moving average
rank(rsi(14), 50) > 0.9              // RSI in top 10% of its 50-bar range
correlation(close(), volume(), 20)    // price-volume correlation
</code></pre>

<h4>Composition</h4>
<p>Range, aggregates, and transforms compose freely with indicators:</p>
<pre class="code"><code data-lang="">
max(range(rsi(14), 1, 10)) > 70     // highest RSI in last 10 bars exceeded 70
slope(mean(range(close(), 0, 20)), 5) > 0  // trend of 20-day moving average
zscore(volume(), 10) > 2 and close() > sma(50)  // volume spike above trend
</code></pre>

<h4>Boolean windows (convenience)</h4>
<ul>
<li><code>count_true(x:BoolSeries, window:int)</code> → Series[int] — count of True values in window</li>
<li><code>any_true(x:BoolSeries, window:int)</code> → BoolSeries</li>
<li><code>all_true(x:BoolSeries, window:int)</code> → BoolSeries</li>
</ul>

<h3 id="6-4-range-membership-helpers">6.4 Range &amp; membership helpers</h3>

<ul>
<li><code>between(x:Series, lo:Scalar, hi:Scalar)</code> → BoolSeries</li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>between(close(), 11, 14)</code></p>

<p>Output: 20240102    False 20240103    True 20240104    True 20240105    True 20240108    True 20240109    False 20240110    True 20240111    False</p>

<p>Explanation: True where Close is within [11,14].</p>

<ul>
<li><code>x in lo..hi</code> (inclusive)</li>
<li><code>x in {a,b,c}</code> / <code>x not in {…}</code></li>
</ul>
<p><strong>Examples</strong></p>

<pre class="code"><code data-lang="">
mfi(14) in 20..30
month() in {3,6,9,12}
</code></pre>

<h3 id="6-6-events-tradable-only-int-date">6.6 Events (tradable only; int-date)</h3>

<p>Namespace: <code>earnings.<em>&lt;/code&gt; (alias of &lt;code&gt;event.earnings.</em></code>)</p>

<ul>
<li><code>earnings.prev_yyyymmdd()</code> → Series[int64|NA]</li>
<li><code>earnings.next_yyyymmdd()</code> → Series[int64|NA]</li>
<li><code>earnings.bars_since()</code> → Series[int32|NA]</li>
<li><code>earnings.bars_until()</code> → Series[int32|NA]</li>
<li><code>earnings.prev_attr(name:str)</code> → Series[attribute dtype]</li>
<li><code>earnings.next_attr(name:str)</code> → Series[attribute dtype]</li>
<li><code>earnings.is_event_bar()</code> → BoolSeries</li>
<li><code>earnings.within_window(before:int, after:int)</code> → BoolSeries</li>
</ul>
<p><strong>Examples</strong></p>

<pre class="code"><code data-lang="">
earnings.bars_until() &gt; 2
(earnings.bars_since() &gt;= 1) and (earnings.prev_attr(&quot;surprise_pct&quot;) &gt; 5)
earnings.within_window(before=1, after=1)      // near the event day
</code></pre>

<h3 id="6-7-economic-non-daily-series">6.7 Economic / non-daily series</h3>

<ul>
<li>Access via <code>econ.NAME.field()</code> (returns Series on its own <code>Int64Index</code>).</li>
<li>Project onto bar index explicitly:</li>
</ul>

<ul>
<li><code>align_to_bars(series, method=&quot;ffill&quot;|&quot;nearest_prev&quot;|&quot;none&quot;)</code></li>
</ul>
<p><strong>Examples</strong></p>

<pre class="code"><code data-lang="">
align_to_bars(econ.nfp.level(), &quot;ffill&quot;) &gt; 200000
</code></pre>

<h3 id="6-8-period-semantics-int-date">6.8 Period semantics (int-date)</h3>

<ul>
<li><code>week_of_year()</code> → Series[int 1..53]</li>
<li><code>week_of_month()</code> → Series[int ≥ 1]</li>
<li><code>month()</code> → Series[int 1..12]</li>
<li><code>quarter()</code> → Series[int 1..4]</li>
<li><code>is_nth_week_of_month(n:int)</code> → BoolSeries</li>
<li><code>is_quarter(q:int)</code> → BoolSeries</li>
</ul>
<p><strong>Examples</strong></p>

<pre class="code"><code data-lang="">
is_nth_week_of_month(2) and month() in {3,6,9,12}
week_of_year() == 36
</code></pre>

<h3 id="6-9-flags-as-series-producers-canned-shortcuts">6.9 Flags as series producers (canned shortcuts)</h3>

<p>Namespace: <code>flag.*</code></p>

<ul>
<li><code>flag.VMACDCrossoverV2(fast:int=12, slow:int=26, signal:int=9, direction:str=&quot;up&quot;|&quot;down&quot;)</code> → BoolSeries</li>
</ul>
<p><strong>Examples</strong></p>

<pre class="code"><code data-lang="">
any(range(flag.VMACDCrossoverV2(direction=&quot;up&quot;), 7, 3))
count_true(flag.VMACDCrossoverV2(direction=&quot;up&quot;), 5) &gt;= 2
</code></pre>

<hr />

<h2 id="7-examples-ready-to-paste">7) Examples (ready to paste)</h2>

<p><strong>VMACD pattern:</strong> fired in bars 5-9, and NOT bar 11</p>

<pre class="code"><code data-lang="">
(
  any(range(flag.VMACDCrossoverV2(direction=&quot;up&quot;), 7, 3))
  or any(range(flag.VMACDCrossoverV2(direction=&quot;up&quot;), 5, 2))
)
and not any(range(flag.VMACDCrossoverV2(direction=&quot;up&quot;), 11, 1))
</code></pre>

<p><strong>Max of past highs</strong></p>

<pre class="code"><code data-lang="">
max(range(high(), 7, 3))
</code></pre>

<p><strong>Bollinger breakout with prior VMACD</strong></p>

<pre class="code"><code data-lang="">
any(range(flag.VMACDCrossoverV2(direction=&quot;up&quot;), 7, 3))
and close() &gt; bb_upper(window=20, k=2)
</code></pre>

<p><strong>At least 2 fires in last 5 bars</strong></p>

<pre class="code"><code data-lang="">
count_true( flag.VMACDCrossoverV2(direction=&quot;up&quot;), 5 ) &gt;= 2
</code></pre>

<p><strong>MFI band + no earnings within 2 bars</strong></p>

<pre class="code"><code data-lang="">
(mfi(14) in 20..30) and ( (earnings.bars_until() &gt; 2) or (earnings.bars_until() &lt; 0) )
</code></pre>

<p><strong>2nd week of month &amp; strong NFP</strong></p>

<pre class="code"><code data-lang="">
is_nth_week_of_month(2)
and align_to_bars( econ.nfp.level(), &quot;ffill&quot; ) &gt; 200000
</code></pre>

<hr />

<h2 id="8-error-code-catalog">8) Error code catalog</h2>

<p>All errors include a caret-spanned snippet with start–end character positions where applicable.</p>

<p>| Code                   | Name                 | When it triggers                          | Example                                 | Remediation                                   | | ---------------------- | -------------------- | ----------------------------------------- | --------------------------------------- | --------------------------------------------- | | <strong>E_LEX_BAD_CHAR</strong>     | InvalidCharacter     | Unknown symbol outside strings            | <code>close() $ 5</code>                           | Remove/replace offending char                 | | <strong>E_LEX_BAD_STRING</strong>   | BadStringLiteral     | Unterminated/invalid escape               | <code>&quot;mfi(14)</code>                              | Close quotes, escape properly                 | | <strong>E_PARSE_UNEXPECTED</strong> | UnexpectedToken      | Token not expected by grammar             | <code>mfi(14))</code>                              | Fix parentheses/sequence                      |</p>

<p><strong>Worked Example</strong> Input (High): 20240102    11.0 20240103    12.0 20240104    13.0 20240105    12.0 20240108    14.0 20240109    15.0 20240110    14.0 20240111    16.0</p>

<p>Input (Low): 20240102    9.0 20240103    10.0 20240104    11.0 20240105    10.0 20240108    12.0 20240109    13.0 20240110    12.0 20240111    14.0</p>

<p>Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3</p>

<p>Input (Volume): 20240102    100.0 20240103    120.0 20240104    130.0 20240105    110.0 20240108    150.0 20240109    160.0 20240110    140.0 20240111    180.0 Expression: <code>mfi(window=3)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    74.0999 20240105    70.5587 20240108    74.4617 20240109    77.6667 20240110    69.8169 20240111    73.1403</p>

<p>Explanation: MFI uses typical price and volume; bounded 0–100; warmup until 3 bars.</p>

<p>| <strong>E_PARSE_MISSING</strong>    | MissingToken         | Required token absent                     | <code>bb_upper(n=20 k=2)</code>                    | Insert missing comma, bracket, etc.           |</p>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>bb_upper(window=3, k=2.0)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    13.1088 20240105    12.7136 20240108    14.5341 20240109    16.1187 20240110    14.7039 20240111    16.4</p>

<p>Explanation: Upper band = mid + k*std.</p>

<p>| <strong>E_PARSE_PRECEDENCE</strong> | AmbiguousParse       | Parser recovery ambiguity                 | Rare; usually mixed <code>and/or</code> w/o parens | Add parentheses                               | | <strong>E_UNKNOWN_ID</strong>       | UnknownIdentifier    | Name can’t be resolved                    | <code>mfiix(14)</code>                             | Fix typo or register dataset                  | | <strong>E_UNKNOWN_FLAG</strong>     | UnknownFlag          | <code>flag.X</code> not registered                   | <code>flag.MagicCross()</code>                     | Use a valid flag name                         | | <strong>E_ARITY</strong>            | ArityMismatch        | Wrong number of args                      | <code>mfi()</code>                                 | Add required args                             |</p>

<p><strong>Worked Example</strong> Input (High): 20240102    11.0 20240103    12.0 20240104    13.0 20240105    12.0 20240108    14.0 20240109    15.0 20240110    14.0 20240111    16.0</p>

<p>Input (Low): 20240102    9.0 20240103    10.0 20240104    11.0 20240105    10.0 20240108    12.0 20240109    13.0 20240110    12.0 20240111    14.0</p>

<p>Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3</p>

<p>Input (Volume): 20240102    100.0 20240103    120.0 20240104    130.0 20240105    110.0 20240108    150.0 20240109    160.0 20240110    140.0 20240111    180.0 Expression: <code>mfi(window=3)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    74.0999 20240105    70.5587 20240108    74.4617 20240109    77.6667 20240110    69.8169 20240111    73.1403</p>

<p>Explanation: MFI uses typical price and volume; bounded 0–100; warmup until 3 bars.</p>

<p>| <strong>E_TYPE</strong>             | TypeMismatch         | Wrong arg type or op types                | <code>lag(&quot;foo&quot;, 5)</code>                         | Fix types per function signature              |</p>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>lag(close(), 2)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    10.5 20240105    11.5 20240108    12.2 20240109    11.1 20240110    13.4 20240111    14.2</p>

<p>Explanation: Shift series back by 2 bars; first 2 outputs NaN.</p>

<p>| <strong>E_RANGE</strong>            | RangeError           | Invalid range/set literal                 | <code>30..20</code> (if disallowed by context)     | Swap bounds or use <code>between</code> reversed         | | <strong>E_SET</strong>              | SetLiteralError      | Bad set syntax                            | <code>{1, ,2}</code>                               | Fix set list                                  | | <strong>E_DOMAIN</strong>           | DomainError          | Dataset not available in domain           | <code>econ.close()</code>                          | Use correct domain/dataset                    | | <strong>E_ALIGN</strong>            | AlignmentError       | Mixed indexes without explicit projection | <code>close() &gt; econ.nfp.level()</code>            | Use <code>align_to_bars(...)</code>                      | | <strong>E_SERIES_LEN</strong>       | SeriesLengthMismatch | Aggregation inputs differ in index/len    | <code>max(close(), high()@1_on_other_index)</code> | Ensure same index/align first                 |</p>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>max(range(close(), 1, 3))</code></p>

<p>Output: 20240102    NaN 20240103    10.5 20240104    11.5 20240105    12.2 20240108    12.2 20240109    13.4 20240110    14.2 20240111    14.2</p>

<p>Explanation: Maximum of close from 1 to 3 bars ago.</p>

<p>| <strong>E_LAG</strong>              | LagError             | Negative/zero/invalid lag                 | <code>x @ -1</code> (use lead)                     | Use <code>lead(x,k)</code> or positive lag               |</p>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>lead(close(), 2)</code></p>

<p>Output: 20240102    12.2 20240103    11.1 20240104    13.4 20240105    14.2 20240108    13.1 20240109    15.3 20240110    NaN 20240111    NaN</p>

<p>Explanation: Shift series forward by 2 bars; last 2 outputs NaN.</p>

<p>| <strong>E_ARG</strong>              | InvalidArgument      | Unknown named arg                         | <code>mfi(period=14)</code>                        | Use <code>n=14</code> as documented                      |</p>

<p><strong>Worked Example</strong> Input (High): 20240102    11.0 20240103    12.0 20240104    13.0 20240105    12.0 20240108    14.0 20240109    15.0 20240110    14.0 20240111    16.0</p>

<p>Input (Low): 20240102    9.0 20240103    10.0 20240104    11.0 20240105    10.0 20240108    12.0 20240109    13.0 20240110    12.0 20240111    14.0</p>

<p>Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3</p>

<p>Input (Volume): 20240102    100.0 20240103    120.0 20240104    130.0 20240105    110.0 20240108    150.0 20240109    160.0 20240110    140.0 20240111    180.0 Expression: <code>mfi(window=3)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    74.0999 20240105    70.5587 20240108    74.4617 20240109    77.6667 20240110    69.8169 20240111    73.1403</p>

<p>Explanation: MFI uses typical price and volume; bounded 0–100; warmup until 3 bars.</p>

<p>| <strong>E_EVENT_ATTR</strong>       | EventAttrMissing     | Attribute not present in event table      | <code>earnings.prev_attr(&quot;foo&quot;)</code>             | Use supported attr name                       | | <strong>E_EXEC</strong>             | EvalError            | Runtime evaluation failure                | division by zero in strict mode         | Adjust expression or enable NaN-tolerant path | | <strong>E_INTERNAL</strong>         | InternalError        | Unexpected engine fault                   | N/A                                     | File a bug; include expression & log          |</p>

<p><strong>Notes</strong></p>

<ul>
<li><code>E_ALIGN</code> is <strong>fatal</strong>: we do not auto-convert or resample; call <code>align_to_bars(...)</code>.</li>
<li><code>E_TYPE</code> also fires if you try <code>in</code> against a non-literal set (not supported): <code>x in other_series</code> → use comparisons instead.</li>
</ul>

<hr />

<h2 id="9-determinism-alignment-rules">9) Determinism &amp; alignment rules</h2>

<ul>
<li>All Series <strong>must</strong> share the same <code>index_id</code>. No hidden conversions.</li>
<li><code>align_to_bars(series, method=&quot;ffill&quot;|&quot;nearest_prev&quot;|&quot;none&quot;)</code> is the explicit bridge for non-bar series.</li>
<li>The engine never constructs or accepts datetimes. If a loader attempts to return a non-int index → <strong>E_ALIGN</strong> at boundary.</li>
</ul>

<hr />

<h2 id="10-cheatsheet">10) Cheatsheet</h2>

<p><strong>Range + aggregates</strong></p>

<pre class="code"><code data-lang="">
max(range(close(), 1, 20))            // 20-day high (excluding today)
min(range(low(), 0, 10))              // 10-day low (including today)
any(range(rsi(14) > 70, 1, 5))       // RSI overbought in last 5 days?
</code></pre>

<p><strong>Transforms</strong></p>

<pre class="code"><code data-lang="">
change(close(), 5) > 0                // up vs 5 bars ago
zscore(volume(), 10) > 2              // volume spike
slope(close(), 10) > 0                // 10-bar uptrend
</code></pre>

<p><strong>Membership &amp; ranges</strong></p>

<pre class="code"><code data-lang="">
mfi(14) in 20..30
month() in {1,4,7,10}
</code></pre>

<p><strong>Boolean windows &amp; counts</strong></p>

<pre class="code"><code data-lang="">
count_true(flag.VMACDCrossoverV2(direction=&quot;up&quot;), 5) &gt;= 2
</code></pre>

<p><strong>Events (tradable)</strong></p>

<pre class="code"><code data-lang="">
earnings.bars_since() &lt;= 3
earnings.prev_attr(&quot;surprise_pct&quot;) &gt; 5
</code></pre>

<p><strong>Periods</strong></p>

<pre class="code"><code data-lang="">
is_nth_week_of_month(2) and quarter() in {1,3}
</code></pre>

<hr />


<hr />

<h2 id="appendix-annotation-registry-additions-for-expression-language-guide-append-only">Appendix: Annotation Registry additions for Expression Language Guide (append-only)</h2>
<p>This section lists expression functions present in the AnnotationRegistry that were not already documented above. No existing documentation has been removed or altered.</p>


<h3 id="all-all">\`all()\` — All</h3>
<p>True if all elements of the series (or lag set) are True.</p>

<p><strong>Params:</strong></p>
<ul>
<li><code>series_or_lagset</code> (series[bool]|DataFrame), default=None — Input boolean series or lag set</li>
</ul>

<p><strong>Returns:</strong> bool</p>

<p><strong>Semantics:</strong></p>
<ul>
<li>Output series (when applicable) are aligned to the canonical Int64Index[YYYYMMDD] and preserve <code>index_id</code> identity.</li>
<li>No datetime/Timestamp creation; integer-date only.</li>
</ul>

<p><strong>Examples:</strong></p>
<ul>
<li><code>all(close() &gt; open())</code></li>
<li><code>all(range(close() &gt; open(), 0, 5))</code></li>
</ul>


<h3 id="any-any">\`any()\` — Any</h3>
<p>True if any element of the series (or lag set) is True.</p>

<p><strong>Params:</strong></p>
<ul>
<li><code>series_or_lagset</code> (series[bool]|DataFrame), default=None — Input boolean series or lag set</li>
</ul>

<p><strong>Returns:</strong> bool</p>

<p><strong>Semantics:</strong></p>
<ul>
<li>Output series (when applicable) are aligned to the canonical Int64Index[YYYYMMDD] and preserve <code>index_id</code> identity.</li>
<li>No datetime/Timestamp creation; integer-date only.</li>
</ul>

<p><strong>Examples:</strong></p>
<ul>
<li><code>any(close() &gt; open())</code></li>
<li><code>any(range(flag.MyFlag(), 1, 3))</code></li>
</ul>


<h3 id="count-if-count-if">\`count_if()\` — Count if</h3>
<p>Count the number of True values in a boolean series.</p>

<p><strong>Params:</strong></p>
<ul>
<li><code>series</code> (series[bool]), default=None — Boolean series to count</li>
</ul>

<p><strong>Returns:</strong> float</p>

<p><strong>Semantics:</strong></p>
<ul>
<li>Output series (when applicable) are aligned to the canonical Int64Index[YYYYMMDD] and preserve <code>index_id</code> identity.</li>
<li>No datetime/Timestamp creation; integer-date only.</li>
</ul>

<p><strong>Examples:</strong></p>
<ul>
<li><code>count_if(close() &gt; open())</code></li>
</ul>


<h3 id="day-of-week-day-of-week">\`day_of_week()\` — Day of week</h3>
<p>Return integer day of week (0=Monday..4=Friday) on the bar calendar.</p>

<p><strong>Params:</strong> (none)</p>

<p><strong>Returns:</strong> int</p>

<p><strong>Semantics:</strong></p>
<ul>
<li>Output series (when applicable) are aligned to the canonical Int64Index[YYYYMMDD] and preserve <code>index_id</code> identity.</li>
<li>No datetime/Timestamp creation; integer-date only.</li>
</ul>

<p><strong>Examples:</strong></p>
<ul>
<li><code>day_of_week() = 0</code></li>
<li><code>day_of_week() in 0..4</code></li>
</ul>


<h3 id="in-range-in-range-inclusive">\`in_range()\` — In range inclusive</h3>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>close() in 11..14</code></p>

<p>Output: 20240102    False 20240103    True 20240104    True 20240105    True 20240108    True 20240109    False 20240110    True 20240111    False</p>

<p>Explanation: Range membership is inclusive; same as between(close(),11,14).</p>

<p>Alias for between(x, lo, hi) for readability.</p>

<p><strong>Params:</strong></p>
<ul>
<li><code>x</code> (series|scalar), default=None — Input series or scalar</li>
<li><code>lo</code> (scalar), default=None — Lower bound (inclusive)</li>
<li><code>hi</code> (scalar), default=None — Upper bound (inclusive)</li>
</ul>

<p><strong>Returns:</strong> bool</p>

<p><strong>Semantics:</strong></p>
<ul>
<li>Output series (when applicable) are aligned to the canonical Int64Index[YYYYMMDD] and preserve <code>index_id</code> identity.</li>
<li>No datetime/Timestamp creation; integer-date only.</li>
</ul>

<p><strong>Examples:</strong></p>
<ul>
<li><code>in_range(close(), 20, 30)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Close): 20240102    10.5 20240103    11.5 20240104    12.2 20240105    11.1 20240108    13.4 20240109    14.2 20240110    13.1 20240111    15.3 Expression: <code>close() in 11..14</code></p>

<p>Output: 20240102    False 20240103    True 20240104    True 20240105    True 20240108    True 20240109    False 20240110    True 20240111    False</p>

<p>Explanation: Range membership is inclusive; same as between(close(),11,14).</p>



<h3 id="lagset-lag-set">\`lagset()\` — Lag set</h3>
<p>Build a lag set (DataFrame) from a series and a list of offsets.</p>

<p><strong>Params:</strong></p>
<ul>
<li><code>series</code> (series), default=None — Input series to lag</li>
<li><code>offsets</code> (list[int]), default=None — List of bar offsets</li>
</ul>

<p><strong>Returns:</strong> DataFrame</p>

<p><strong>Semantics:</strong></p>
<ul>
<li>Output series (when applicable) are aligned to the canonical Int64Index[YYYYMMDD] and preserve <code>index_id</code> identity.</li>
<li>No datetime/Timestamp creation; integer-date only.</li>
</ul>

<p><strong>Examples:</strong></p>
<ul>
<li><code>lagset(close(), [1,2,3])</code></li>
</ul>


<h3 id="rolling-all-rolling-all">\`rolling_all()\` — Rolling all</h3>
<p>True if all bars in the trailing window are True.</p>

<p><strong>Params:</strong></p>
<ul>
<li><code>series</code> (series|None), default=None — Boolean series to scan</li>
<li><code>window</code> (int), default=20 — Window length in bars</li>
</ul>

<p><strong>Returns:</strong> bool</p>

<p><strong>Semantics:</strong></p>
<ul>
<li>Output series (when applicable) are aligned to the canonical Int64Index[YYYYMMDD] and preserve <code>index_id</code> identity.</li>
<li>No datetime/Timestamp creation; integer-date only.</li>
</ul>

<p><strong>Examples:</strong></p>
<ul>
<li><code>rolling_all(close() &gt; open(), 5)</code></li>
</ul>


<h3 id="rolling-any-rolling-any">\`rolling_any()\` — Rolling any</h3>
<p>True if any bar in the trailing window is True.</p>

<p><strong>Params:</strong></p>
<ul>
<li><code>series</code> (series|None), default=None — Boolean series to scan</li>
<li><code>window</code> (int), default=20 — Window length in bars</li>
</ul>

<p><strong>Returns:</strong> bool</p>

<p><strong>Semantics:</strong></p>
<ul>
<li>Output series (when applicable) are aligned to the canonical Int64Index[YYYYMMDD] and preserve <code>index_id</code> identity.</li>
<li>No datetime/Timestamp creation; integer-date only.</li>
</ul>

<p><strong>Examples:</strong></p>
<ul>
<li><code>rolling_any(close() &gt; open(), 5)</code></li>
</ul>


<h3 id="rolling-count-rolling-count">\`rolling_count()\` — Rolling count</h3>
<p>Number of non-NaN observations in the trailing window.</p>

<p><strong>Params:</strong></p>
<ul>
<li><code>series</code> (series|None), default=None — Input series (defaults to close())</li>
<li><code>window</code> (int), default=20 — Window length in bars</li>
</ul>

<p><strong>Returns:</strong> float</p>

<p><strong>Semantics:</strong></p>
<ul>
<li>Output series (when applicable) are aligned to the canonical Int64Index[YYYYMMDD] and preserve <code>index_id</code> identity.</li>
<li>No datetime/Timestamp creation; integer-date only.</li>
</ul>

<p><strong>Examples:</strong></p>
<ul>
<li><code>rolling_count(20)</code></li>
<li><code>rolling_count(close(), 20)</code></li>
</ul>


<h3 id="rolling-median-rolling-median">\`rolling_median()\` — Rolling median</h3>
<p>Median of a series over a trailing window of bars.</p>

<p><strong>Params:</strong></p>
<ul>
<li><code>series</code> (series|None), default=None — Input series (defaults to close())</li>
<li><code>window</code> (int), default=20 — Window length in bars</li>
</ul>

<p><strong>Returns:</strong> float</p>

<p><strong>Semantics:</strong></p>
<ul>
<li>Output series (when applicable) are aligned to the canonical Int64Index[YYYYMMDD] and preserve <code>index_id</code> identity.</li>
<li>No datetime/Timestamp creation; integer-date only.</li>
</ul>

<p><strong>Examples:</strong></p>
<ul>
<li><code>rolling_median(20)</code></li>
<li><code>rolling_median(close(), 20)</code></li>
</ul>


<h3 id="rolling-rank-rolling-rank">\`rolling_rank()\` — Rolling rank</h3>
<p>Rank of the current value within a trailing window.</p>

<p><strong>Params:</strong></p>
<ul>
<li><code>series</code> (series|None), default=None — Input series (defaults to close())</li>
<li><code>window</code> (int), default=20 — Window length in bars</li>
</ul>

<p><strong>Returns:</strong> float</p>

<p><strong>Semantics:</strong></p>
<ul>
<li>Output series (when applicable) are aligned to the canonical Int64Index[YYYYMMDD] and preserve <code>index_id</code> identity.</li>
<li>No datetime/Timestamp creation; integer-date only.</li>
</ul>

<p><strong>Examples:</strong></p>
<ul>
<li><code>rolling_rank(20)</code></li>
<li><code>rolling_rank(close(), 20)</code></li>
</ul>


<h3 id="rolling-sum-rolling-sum">\`rolling_sum()\` — Rolling sum</h3>

<p><strong>Worked Example</strong> Input (Volume): 20240102    100.0 20240103    120.0 20240104    130.0 20240105    110.0 20240108    150.0 20240109    160.0 20240110    140.0 20240111    180.0 Expression: <code>rolling_sum(volume(), 3)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    350.0 20240105    360.0 20240108    390.0 20240109    420.0 20240110    450.0 20240111    480.0</p>

<p>Explanation: Sum over last 3 bars; first 2 NaN.</p>

<p>Sum of a series over a trailing window of bars.</p>

<p><strong>Params:</strong></p>
<ul>
<li><code>series</code> (series|None), default=None — Input series (defaults to close())</li>
<li><code>window</code> (int), default=20 — Window length in bars</li>
</ul>

<p><strong>Returns:</strong> float</p>

<p><strong>Semantics:</strong></p>
<ul>
<li>Output series (when applicable) are aligned to the canonical Int64Index[YYYYMMDD] and preserve <code>index_id</code> identity.</li>
<li>No datetime/Timestamp creation; integer-date only.</li>
</ul>

<p><strong>Examples:</strong></p>
<ul>
<li><code>rolling_sum(20)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Volume): 20240102    100.0 20240103    120.0 20240104    130.0 20240105    110.0 20240108    150.0 20240109    160.0 20240110    140.0 20240111    180.0 Expression: <code>rolling_sum(volume(), 3)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    350.0 20240105    360.0 20240108    390.0 20240109    420.0 20240110    450.0 20240111    480.0</p>

<p>Explanation: Sum over last 3 bars; first 2 NaN.</p>

<ul>
<li><code>rolling_sum(close(), 20)</code></li>
</ul>

<p><strong>Worked Example</strong> Input (Volume): 20240102    100.0 20240103    120.0 20240104    130.0 20240105    110.0 20240108    150.0 20240109    160.0 20240110    140.0 20240111    180.0 Expression: <code>rolling_sum(volume(), 3)</code></p>

<p>Output: 20240102    NaN 20240103    NaN 20240104    350.0 20240105    360.0 20240108    390.0 20240109    420.0 20240110    450.0 20240111    480.0</p>

<p>Explanation: Sum over last 3 bars; first 2 NaN.</p>

<hr />
<h2 id="appendix-missing-registry-functions">Appendix: Additional registry functions</h2>
<p>These functions are present in the AnnotationRegistry but were not previously documented in this HTML guide.</p>
<h3 id="fn-crosses_under"><code>crosses_under(…)</code> — Crosses under</h3>
<p>True on bars where series A crosses from above to below series B.</p>
<p><strong>Examples:</strong></p><ul>
<li><code>crosses_under(close(), sma(20))</code></li>
<li><code>crosses_under(rsi(14), 50)</code></li>
</ul>
<h3 id="fn-macd_signal"><code>macd_signal(…)</code> — MACD Signal</h3>
<p>Signal line of MACD: EMA(signal) of the MACD line (EMA_fast − EMA_slow).</p>
<p><strong>Examples:</strong></p><ul>
<li><code>macd_signal(fast=12, slow=26, signal=9)</code></li>
<li><code>macd_signal(fast=3, slow=5, signal=2)</code></li>
</ul>
<h3 id="fn-macd_hist"><code>macd_hist(…)</code> — MACD Histogram</h3>
<p>Histogram of MACD: MACD line − MACD signal line.</p>
<p><strong>Examples:</strong></p><ul>
<li><code>macd_hist(fast=12, slow=26, signal=9)</code></li>
<li><code>macd_hist(fast=3, slow=5, signal=2)</code></li>
</ul>
<h3 id="fn-open_"><code>open_(…)</code> — Open (alias)</h3>
<p>Alias for the daily Open price series (use if your environment exposes the name as open_).</p>
<p><strong>Examples:</strong></p><ul>
<li><code>open_()</code></li>
<li><code>open_() @ 1</code></li>
</ul>
<hr />
<h2 id="appendix-strategy-flags-v2">Appendix: Strategy flags (V2)</h2>
<p>All flags are referenced as <code>flag.FlagName(...)</code> and return a boolean Series.</p>
<p><strong>Tip:</strong> Most flags support <code>lookback_days</code> to require consecutive in-condition bars.</p>
<h3 id="flag-atrstopv2"><code>flag.ATRStopV2(...)</code> — ATR Stop (V2)</h3>
<p>ATR-based trailing stop (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>ATRStopV2(n: int = 14, k: float = 3.0, use_current_open: bool = False)</code></li>
<li><strong>Example:</strong> <code>flag.ATRStopV2(n=...)</code></li>
</ul>
<h3 id="flag-vmacdsignalv2"><code>flag.VMACDSignalV2(...)</code> — VMACD Signal (V2)</h3>
<p>Volume-weighted MACD signal-mode flag (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>VMACDSignalV2(fast: int = 12, slow: int = 26, signal: int = 9, mode: str = 'hist_sign', source_column: str = "vwap")</code></li>
<li><strong>Example:</strong> <code>flag.VMACDSignalV2(fast=...)</code></li>
</ul>
<h3 id="flag-vmfi_macdcrossoverv2"><code>flag.VMFI_MACDCrossoverV2(...)</code> — VMFI + MACD Crossover (V2)</h3>
<p>VMFI + MACD crossover composite flag (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>VMFI_MACDCrossoverV2(fast: int = 12, slow: int = 26, signal: int = 9, direction: str = 'up', lookback: int = 14)</code></li>
<li><strong>Example:</strong> <code>flag.VMFI_MACDCrossoverV2(fast=...)</code></li>
</ul>
<h3 id="flag-vmfi_macdsignalv2"><code>flag.VMFI_MACDSignalV2(...)</code> — VMFI + MACD Signal (V2)</h3>
<p>VMFI + MACD signal-mode composite flag (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>VMFI_MACDSignalV2(fast: int = 12, slow: int = 26, signal: int = 9, mode: str = "hist_sign", lookback: int = 14)</code></li>
<li><strong>Example:</strong> <code>flag.VMFI_MACDSignalV2(fast=...)</code></li>
</ul>
<h3 id="flag-vmfisignalv2"><code>flag.VMFISignalV2(...)</code> — VMFI Signal (V2)</h3>
<p>Volume Money Flow Index (VMFI) threshold flag (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>VMFISignalV2(threshold: float = 20, hi_threshold: float = 85, source_column: str = "vwap", lookback_days: int = 1)</code></li>
<li><strong>Example:</strong> <code>flag.VMFISignalV2(threshold=...)</code></li>
</ul>
<h3 id="flag-industrytop20filterv2"><code>flag.IndustryTop20FilterV2(...)</code> — Industry Top-N Filter (V2)</h3>
<p>Industry-level top/bottom filter (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>IndustryTop20FilterV2(n: int = 20, direction: str = "top", lookback: int = 20)</code></li>
<li><strong>Example:</strong> <code>flag.IndustryTop20FilterV2(n=...)</code></li>
</ul>
<h3 id="flag-topstocksinindustryfilterv2"><code>flag.TopStocksInIndustryFilterV2(...)</code> — Top Stocks In Industry (V2)</h3>
<p>Top/bottom stocks within each industry filter (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>TopStocksInIndustryFilterV2(n: int = 5, direction: str = "top", lookback: int = 20)</code></li>
<li><strong>Example:</strong> <code>flag.TopStocksInIndustryFilterV2(n=...)</code></li>
</ul>
<h3 id="flag-sigmasignalv2"><code>flag.SigmaSignalV2(...)</code> — Sigma Signal (V2)</h3>
<p>Sigma-based move detector (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>SigmaSignalV2(n: int = 20, k: float = 2.0, direction: str = "down", mode: str = "pct", lookback_days: int = 1)</code></li>
<li><strong>Example:</strong> <code>flag.SigmaSignalV2(n=...)</code></li>
</ul>
<h3 id="flag-zscoresignalv2"><code>flag.ZScoreSignalV2(...)</code> — ZScore Signal (V2)</h3>
<p>Z-score-based move detector (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>ZScoreSignalV2(n: int = 20, k: float = 1.0, direction: str = "down", mode: str = "pct", lookback_days: int = 1,)</code></li>
<li><strong>Example:</strong> <code>flag.ZScoreSignalV2(n=...)</code></li>
</ul>
<h3 id="flag-expressionflagv2"><code>flag.ExpressionFlagV2(...)</code> — Expression Flag (V2)</h3>
<p>Expression-driven strategy flag (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>ExpressionFlagV2(expression: str,  label: str | None = None)</code></li>
<li><strong>Example:</strong> <code>flag.ExpressionFlagV2(expression=...)</code></li>
</ul>
<h3 id="flag-chaikinmoneyflowflagv2"><code>flag.ChaikinMoneyFlowFlagV2(...)</code> — Chaikin Money Flow Flag (V2)</h3>
<p>Chaikin Money Flow (CMF) convenience flag (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>ChaikinMoneyFlowFlagV2(window: int = 20, op: str = "&gt;", threshold: float = 0.0, label: str | None = None)</code></li>
<li><strong>Example:</strong> <code>flag.ChaikinMoneyFlowFlagV2(window=...)</code></li>
</ul>
<h3 id="flag-accumulationdistributionoscillatorflagv2"><code>flag.AccumulationDistributionOscillatorFlagV2(...)</code> — A/D Oscillator Flag (V2)</h3>
<p>Accumulation/Distribution Oscillator convenience flag (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>AccumulationDistributionOscillatorFlagV2(fast: int = 3, slow: int = 10, op: str = "&gt;", threshold: float = 0.0, label: str | None = None)</code></li>
<li><strong>Example:</strong> <code>flag.AccumulationDistributionOscillatorFlagV2(fast=...)</code></li>
</ul>
<h3 id="flag-chaikinoscillatorflagv2"><code>flag.ChaikinOscillatorFlagV2(...)</code> — Chaikin Oscillator Flag (V2)</h3>
<p>Chaikin Oscillator convenience flag (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>ChaikinOscillatorFlagV2(fast: int = 3, slow: int = 10, op: str = "&gt;", threshold: float = 0.0, label: str | None = None)</code></li>
<li><strong>Example:</strong> <code>flag.ChaikinOscillatorFlagV2(fast=...)</code></li>
</ul>
<h3 id="flag-movingaverageflagv2"><code>flag.MovingAverageFlagV2(...)</code> — Moving Average Flag (V2)</h3>
<p>Price-vs-moving-average convenience flag (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>MovingAverageFlagV2(ma_type: str = "ema", window: int = 20, column: str = "Close", mode: str = "cross_over", alma_offset: float = 0.85, alma_sigma: float = 6.0, kama_fast: int = 2, kama_slow: int = 30, label: str | None = None,)</code></li>
<li><strong>Example:</strong> <code>flag.MovingAverageFlagV2(ma_type=...)</code></li>
</ul>
<h3 id="flag-aposignalv2"><code>flag.APOSignalV2(...)</code> — APO Signal (V2)</h3>
<p>Absolute Price Oscillator (APO) zero-line signal (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>APOSignalV2(fast: int = 12, slow: int = 26, direction: str = "up", lookback_days: int = 1)</code></li>
<li><strong>Example:</strong> <code>flag.APOSignalV2(fast=...)</code></li>
</ul>
<h3 id="flag-pposignalv2"><code>flag.PPOSignalV2(...)</code> — PPO Signal (V2)</h3>
<p>Percentage Price Oscillator (PPO) zero-line signal (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>PPOSignalV2(fast: int = 12, slow: int = 26, direction: str = "up", lookback_days: int = 1)</code></li>
<li><strong>Example:</strong> <code>flag.PPOSignalV2(fast=...)</code></li>
</ul>
<h3 id="flag-momentumsignalv2"><code>flag.MomentumSignalV2(...)</code> — Momentum Signal (V2)</h3>
<p>Momentum-based directional signal (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>MomentumSignalV2(window: int = 10, direction: str = "up", lookback_days: int = 1)</code></li>
<li><strong>Example:</strong> <code>flag.MomentumSignalV2(window=...)</code></li>
</ul>
<h3 id="flag-rocsignalv2"><code>flag.ROCSignalV2(...)</code> — ROC Signal (V2)</h3>
<p>Rate-of-change (ROC) percentage signal (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>ROCSignalV2(window: int = 10, direction: str = "up", lookback_days: int = 1)</code></li>
<li><strong>Example:</strong> <code>flag.ROCSignalV2(window=...)</code></li>
</ul>
<h3 id="flag-rocpsignalv2"><code>flag.ROCPSignalV2(...)</code> — ROCP Signal (V2)</h3>
<p>Rate-of-change percent (ROCP) signal (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>ROCPSignalV2(window: int = 10, direction: str = "up", lookback_days: int = 1)</code></li>
<li><strong>Example:</strong> <code>flag.ROCPSignalV2(window=...)</code></li>
</ul>
<h3 id="flag-rocrsignalv2"><code>flag.ROCRSignalV2(...)</code> — ROCR Signal (V2)</h3>
<p>Rate-of-change ratio (ROCR) signal (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>ROCRSignalV2(window: int = 10, direction: str = "up", lookback_days: int = 1)</code></li>
<li><strong>Example:</strong> <code>flag.ROCRSignalV2(window=...)</code></li>
</ul>
<h3 id="flag-trixsignalv2"><code>flag.TRIXSignalV2(...)</code> — TRIX Signal (V2)</h3>
<p>TRIX triple-EMA oscillator signal (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>TRIXSignalV2(window: int = 15, direction: str = "up", lookback_days: int = 1)</code></li>
<li><strong>Example:</strong> <code>flag.TRIXSignalV2(window=...)</code></li>
</ul>
<h3 id="flag-cmosignalv2"><code>flag.CMOSignalV2(...)</code> — CMO Band Signal (V2)</h3>
<p>Chande Momentum Oscillator (CMO) band signal (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>CMOSignalV2(window: int = 14, upper: float = 50.0, lower: float = -50.0, mode: str = "both", lookback_days: int = 1,)</code></li>
<li><strong>Example:</strong> <code>flag.CMOSignalV2(window=...)</code></li>
</ul>
<h3 id="flag-ccisignalv2"><code>flag.CCISignalV2(...)</code> — CCI Band Signal (V2)</h3>
<p>Commodity Channel Index (CCI) band signal (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>CCISignalV2(window: int = 20, upper: float = 100.0, lower: float = -100.0, mode: str = "both", lookback_days: int = 1,)</code></li>
<li><strong>Example:</strong> <code>flag.CCISignalV2(window=...)</code></li>
</ul>
<h3 id="flag-williamsrsignalv2"><code>flag.WilliamsRSignalV2(...)</code> — Williams %R Band Signal (V2)</h3>
<p>Williams %R overbought/oversold band signal (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>WilliamsRSignalV2(window: int = 14, overbought: float = -20.0, oversold: float = -80.0, mode: str = "both", lookback_days: int = 1,)</code></li>
<li><strong>Example:</strong> <code>flag.WilliamsRSignalV2(window=...)</code></li>
</ul>
<h3 id="flag-obvsignalv2"><code>flag.OBVSignalV2(...)</code> — On-Balance Volume (OBV) Trend Signal (V2)</h3>
<p>On-Balance Volume (OBV) trend signal (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>OBVSignalV2(direction: str = "up", lookback_days: int = 1)</code></li>
<li><strong>Example:</strong> <code>flag.OBVSignalV2(direction=...)</code></li>
</ul>
<h3 id="flag-stochsignalv2"><code>flag.StochSignalV2(...)</code> — Stochastic %K Band Signal (V2)</h3>
<p>Stochastic %K overbought/oversold band signal (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>StochSignalV2(k_window: int = 14, d_window: int = 3, smooth_k: int = 1, column: str = "Close", upper: float = 80.0, lower: float = 20.0, mode: str = "both", lookback_days: int = 1,)</code></li>
<li><strong>Example:</strong> <code>flag.StochSignalV2(k_window=...)</code></li>
</ul>
<h3 id="flag-stochrsisignalv2"><code>flag.StochRSISignalV2(...)</code> — Stochastic RSI Band Signal (V2)</h3>
<p>Stochastic RSI band signal (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>StochRSISignalV2(rsi_window: int = 14, stoch_window: int = 14, column: str = "Close", upper: float = 0.8, lower: float = 0.2, mode: str = "both", lookback_days: int = 1,)</code></li>
<li><strong>Example:</strong> <code>flag.StochRSISignalV2(rsi_window=...)</code></li>
</ul>
<h3 id="flag-adxsignalv2"><code>flag.ADXSignalV2(...)</code> — ADX Trend Strength Signal (V2)</h3>
<p>Average Directional Index (ADX) trend-strength signal (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>ADXSignalV2(window: int = 14, threshold: float = 25.0, mode: str = "above", lookback_days: int = 1,)</code></li>
<li><strong>Example:</strong> <code>flag.ADXSignalV2(window=...)</code></li>
</ul>
<h3 id="flag-adxrsignalv2"><code>flag.ADXRSignalV2(...)</code> — ADXR Trend Strength Signal (V2)</h3>
<p>Average Directional Index Rating (ADXR) trend-strength signal (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>ADXRSignalV2(window: int = 14, threshold: float = 25.0, mode: str = "above", lookback_days: int = 1,)</code></li>
<li><strong>Example:</strong> <code>flag.ADXRSignalV2(window=...)</code></li>
</ul>
<h3 id="flag-ultimateoscillatorsignalv2"><code>flag.UltimateOscillatorSignalV2(...)</code> — Ultimate Oscillator Band Signal (V2)</h3>
<p>Ultimate Oscillator overbought/oversold band signal (V2).</p>
<ul>
<li><strong>Signature:</strong> <code>UltimateOscillatorSignalV2(short: int = 7, medium: int = 14, long: int = 28, upper: float = 70.0, lower: float = 30.0, mode: str = "both", lookback_days: int = 1,)</code></li>
<li><strong>Example:</strong> <code>flag.UltimateOscillatorSignalV2(short=...)</code></li>
</ul>
`;
