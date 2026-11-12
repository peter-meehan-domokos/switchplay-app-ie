# **Puckle — Core Functions & Graphs Framework Draft**

## **Section 1 — Understanding Functions**

6 original topics → 3 cards

### **Card 1\. Functions and Notation**

Combines: 1.1 Functions and Relations \+ 1.2 Function Notation

* Step 1 — Video: What a function is, the input–output relationship, $f(x)$ notation, and recognising when a relation is not a function.  
* Step 2 — Video: Evaluating $f(a)$, solving $f(x)=k$, and understanding why different inputs can produce the same output without violating the definition of a function.  
* Step 3 — Exam: Given a function such as $f(x)=2{x}^{2}-3$, evaluate outputs, find inputs and interpret the function notation.

Why combine? Function notation is the language used to express the input–output relationship. There is no compelling reason to separate them.

Interactive visual: Low priority. A simple input–output machine could help, but short videos may be sufficient.

### **Card 2\. Domain and Range**

Combines: 1.3 Domain and Range \+ relevant parts of 1.4 Reading Graphs

* Step 1 — Video: Domain versus range, permitted inputs, possible outputs, and restrictions from denominators, square roots and graph endpoints.  
* Step 2 — Interactive: Explore how restricting the domain changes the portion of a graph displayed and consequently its range. Investigate included and excluded endpoints.  
* Step 3 — Exam: Find the domain and range of a function given algebraically or graphically, including restrictions.

Why separate? Domain and range are distinct, frequently misunderstood concepts. They have a strong visual foundation and apply to later work on inverse functions and composite functions.

Interactive visual: High priority.

### **Card 3\. Sketching and Reading Graphs**

Combines: 1.4 Reading Graphs \+ 1.5 Drawing Graphs \+ 1.6 Function Properties

* Step 1 — Video: Sketch a graph using intercepts, turning points, endpoints and other important features.  
* Step 2 — Interactive: Explore how to read increasing/decreasing intervals, positive/negative values, maxima, minima and symmetry from the graph.  
* Step 3 — Exam: Sketch a given function and answer questions about its mathematical properties.

Why combine? Drawing and interpreting graphs are complementary skills. Students should learn to recognise the same properties when constructing a graph and when analysing an existing one.

Interactive visual: High priority, although we should avoid duplicating the dedicated transformation and graph-family cards likely to appear later in the framework.

## **Section 2 — Equations and Graphs**

6 original topics → 5 cards

### **Card 4\. Roots and Intercepts**

Original: 2.1 Roots and Intercepts

* Step 1 — Video: What $f(x)=0$ means and the connection between roots, zeros, factors and x-intercepts.  
* Step 2 — Interactive: Move roots and observe how the graph, intercept coordinates and factorised expression change together.  
* Step 3 — Exam: Solve a polynomial equation and relate the solutions to the corresponding graph.

Why separate? This is a foundational algebra–graph connection that students must understand before studying graphical solutions more generally.

Interactive visual: High priority. We already have a roots-and-factors interactive experience that could provide much of this functionality.

### **Card 5\. Solving Using Intersections**

Combines: 2.2 Graph Intersections \+ 2.3 Solving Graphically

* Step 1 — Video: Why solving $f(x)=g(x)$ means finding the x-coordinates where two graphs intersect.  
* Step 2 — Interactive: Change one function and explore how the number and position of intersections change. Compare graphical estimates with exact algebraic solutions.  
* Step 3 — Exam: Find the intersection points of a quadratic and a straight line, giving exact coordinates.

Why combine? Both original topics concern the same fundamental mathematical relationship. Graphical estimation and algebraic calculation are two methods of finding the same solutions.

Interactive visual: High priority.

### **Card 6\. Graphical Inequalities**

Original: 2.4 Inequalities

* Step 1 — Video: Solving inequalities algebraically and interpreting the solution intervals graphically.  
* Step 2 — Interactive: Explore where one graph lies above or below another, and how intersection points divide the domain into intervals.  
* Step 3 — Exam: Solve an inequality such as

${x}^{2}-4>x+2.$

Why separate? Moving from equations to inequalities is a substantial conceptual change: students must find intervals instead of individual solutions.

Interactive visual: High priority. This is a particularly strong candidate because students can see the meaning of the inequality directly.

### **Card 7\. Absolute Value**

Original: 2.5 Absolute Value

* Step 1 — Video: Absolute value as distance, and solving basic absolute-value equations.  
* Step 2 — Interactive: Transform $y=f(x)$ into $y=|f(x)|$, observing what happens to negative outputs. Explore the graphical meaning of absolute-value equations and inequalities.  
* Step 3 — Exam: Sketch an absolute-value function and solve an associated equation or inequality.

Why separate? Absolute value introduces a distinctive graphical transformation and particular misconceptions around negative quantities.

Interactive visual: High priority.

### **Card 8\. Valid and Extraneous Solutions**

Original: 2.6 Valid Solutions

* Step 1 — Video: Why operations such as squaring both sides can introduce extraneous solutions, and how domain restrictions affect validity.  
* Step 2 — Interactive: Compare $y=\sqrt{x+6}$ with $y=x$, then investigate why squaring creates an additional algebraic candidate that does not satisfy the original equation.  
* Step 3 — Exam: Solve an equation involving a square root, identify extraneous candidates and verify the valid solutions.

Why separate? This is a powerful conceptual lesson: algebraic manipulation can produce candidate solutions that are not solutions to the original problem.

Interactive visual: High priority.

## **Recommended structure**

| Section | Card | Step 2 |
| ----- | ----- | ----- |
| 1 | Functions and Notation | Video |
| 1 | Domain and Range | Interactive |
| 1 | Sketching and Reading Graphs | Interactive |
| 2 | Roots and Intercepts | Interactive / reuse |
| 2 | Solving Using Intersections | Interactive |
| 2 | Graphical Inequalities | Interactive |
| 2 | Absolute Value | Interactive |
| 2 | Valid and Extraneous Solutions | Interactive |

### **My assessment**

Eight cards is a sensible starting recommendation, but I would particularly scrutinise Card 3\.

“Sketching and Reading Graphs” is potentially too broad for two short teaching steps. It may be better to retain separate cards for graph sketching and graph interpretation, especially if the relevant Leaving Cert exam questions require significantly different techniques.

Conversely, Cards 5 and 6 could potentially share a single interactive environment, even though I would keep them as separate cards because their central learning objectives differ.

That distinction is important: we don't need one entirely new interactive implementation for every card. We can reuse a mathematical environment while presenting different learning tasks and discoveries.

My provisional recommendation is therefore 8 cards, potentially 9 if graph sketching warrants its own card, with one existing roots visual reused and six other interactive opportunities to investigate.

**Refinements for sections 1 and 2**

## **Card 6 — Inequalities**

Central insight: An inequality describes a relationship between quantities, and algebraic operations must preserve that relationship.

I would revise this card to give algebraic inequalities as much importance as graphical inequalities.

Step 1 — Video: Algebraic inequalities

Explain why multiplying or dividing by a negative number reverses the inequality.

For example:

$3<5$

Multiplying both sides by $-1$:

$-3>-5$

But the more important misconception is what happens when the sign of a quantity is unknown.

Consider:

$ax>6$

We cannot simply divide by $a$ and retain the inequality sign. We need to consider:

* $a>0$: $x>6/a$  
* $a<0$: $x<6/a$  
* $a=0$: no solution

This is exactly the kind of reasoning that students can easily overlook when manipulating inequalities.

Step 2 — Interactive: Graphical inequalities

Explore why $f(x)>g(x)$ corresponds to intervals where one graph lies above another, including what happens at their intersections.

I would also consider a short interactive investigation of multiplication by a quantity whose sign can change. This could be incorporated into the same step, although we should assess whether that makes the experience too crowded.

Step 3 — Exam question

A question involving an inequality that students must solve and interpret graphically, ideally including an operation where the direction of the inequality matters.

## **Card 7 — Absolute Value**

Central insight: Absolute value represents distance, not simply a mechanical instruction to remove negative signs.

This is a sufficiently different concept to justify its own card.

Step 1 — Video: Understanding absolute value

Establish the distance interpretation.

For example:

$|x-2|<3$

means that $x$ is less than three units away from $2$.

Therefore:

$-1<x<5$

The crucial conceptual connection is that an absolute-value inequality describes a region on the number line.

Step 2 — Interactive: Absolute-value graphs

Explore how negative outputs of $f(x)$ become positive in the graph of $|f(x)|$, and use the graph to solve absolute-value equations and inequalities.

A useful misconception to investigate is the difference between:

$|f(x)|andf(|x|)$

These are different transformations and generally produce different graphs.

Step 3 — Exam question

Sketch an absolute-value function and solve an associated equation or inequality.

The graph should help students understand why certain absolute-value inequalities produce an interval between two boundaries, while others produce two separate intervals.

## **Card 8 — Valid and Extraneous Solutions**

Central insight: An algebraically valid manipulation does not necessarily preserve exactly the same solution set.

This is where I would give your second major misconception particular attention.

Step 1 — Video: Why extraneous solutions arise

Use the example:

$x=\sqrt{x+6}$

Squaring both sides produces:

${x}^{2}=x+6$

giving candidates $-2$ and $3$.

However, squaring is not reversible without additional conditions: two different numbers can have the same square.

Therefore, we must substitute candidates back into the original equation.

Step 2 — Interactive: The graphical explanation

Compare the original equation graphically with the squared equation.

Students discover that the squared equation has an additional intersection because squaring has removed the sign distinction.

This is a particularly valuable interactive opportunity because it explains why the apparently correct algebra produces an invalid solution.

Step 3 — Exam question

Solve a radical equation, explicitly checking each candidate against the original equation.

## **One important refinement**

I think these three cards can establish a valuable recurring lesson about algebra:

An algebraic operation is not just something we perform mechanically. We need to understand the conditions under which it preserves the mathematical relationship.

There are two particularly important examples:

| Operation | What can go wrong? |
| ----- | ----- |
| Multiplying an inequality by an expression | The inequality direction depends on whether the expression is positive or negative |
| Squaring both sides of an equation | Additional candidate solutions can be introduced because sign information is lost |

Absolute value connects to both because it deals explicitly with positive and negative quantities, but it has its own distinctive meaning as distance.

I would therefore keep 8 cards overall, with Cards 6, 7 and 8 remaining separate.

One refinement to our eventual design process: I would make the unknown-sign inequality issue and the extraneous-root issue two priority misconceptions for interactive treatment. The mathematical insight is important enough that we shouldn't automatically allocate all the interactive attention in Card 6 to graphical intervals and leave the algebraic restriction as something students merely memorise.

# **Puckle — Functions and Graphs**

## **Recommended card structure: Sections 3–8**

My recommendation is 22 cards for the remaining six sections, bringing the complete Functions and Graphs topic to 30 cards.

This reduces the original 44-topic framework by approximately 32%, almost exactly the reduction we achieved in Sections 1 and 2\.

The reduction is deliberately uneven. Some topics naturally belong together; others involve sufficiently different mathematical reasoning, exam techniques or misconceptions to deserve separate cards.

## **1\. Recommended number of cards**

| Section | Original topics | Recommended cards |
| ----- | ----- | ----- |
| 1\. Understanding Functions | 6 | 3 — agreed |
| 2\. Equations and Graphs | 6 | 5 — agreed |
| 3\. Linear and Quadratic Functions | 7 | 4 |
| 4\. Polynomial Functions | 6 | 4 |
| 5\. Graph Transformations | 5 | 3 |
| 6\. Combining and Reversing Functions | 4 | 3 |
| 7\. Other Function Families | 5 | 5 |
| 8\. Functions in Problems | 5 | 3 |
| Total | 44 | 30 |

I would retain all five cards in Section 7\. Although exponential and logarithmic functions are closely related, each has important graphical properties, algebraic techniques and exam applications. Similarly, piecewise and periodic functions are not sufficiently similar to justify merging them merely to save a card.

I've also checked the proposed content against the existing Leaving Certificate Higher Level syllabus and recent examination coverage. In particular, graphing quadratics, cubics, exponentials, logarithms and trigonometric functions, working with composites and inverses, and recognising injective, surjective and bijective functions are established curriculum requirements.

Ordinary level and Higher level+2

The revised mathematics specification is still under consultation as of October 2026, so this recommendation is based on the existing examined syllabus, not proposed future changes.

NCCA

For each proposed card below, I've identified the mathematical focus, all three learning steps, a representative exam-style task and the important misconceptions. As before, these are illustrative exam questions, not verbatim extracts from particular papers.

# **2\. Section 3 — Linear and Quadratic Functions**

7 original topics → 4 cards

I would combine the topics around equivalent representations of quadratics, but preserve completing the square and the discriminant as distinct cards.

The central progression is:

Understand the graph → connect its algebraic forms → reveal its turning point → determine its roots without solving.

### **Card 9\. Linear Functions**

Original: 3.1 Linear Functions

Central insight: A linear function has a constant rate of change, represented by its gradient.

Step 1 — Video: Explain $f(x)=mx+c$, the meaning of gradient and intercept, and how these appear in equations, tables and graphs.

Step 2 — Video: Find the equation of a line from two points or a graph. Distinguish gradient from intercept, and explain positive, negative and zero gradients.

Step 3 — Exam illustration:

A linear function passes through $(2,7)$ and $(5,1)$. Find its equation and explain what its gradient tells you about how the output changes.

Key misconceptions:

* Gradient measures change in $y$ per unit change in $x$, not simply the height of the graph.  
* A negative gradient means the output decreases as the input increases.  
* The y-intercept is the output at $x=0$, not the first point given in a question.

Why no interactive? A gradient visual could be useful, but this is largely established earlier in secondary maths. Two concise videos should be sufficient here. I would prioritise interactive resources for the more demanding concepts that follow.

### **Card 10\. Quadratic Graphs and Forms**

Combines: 3.2 Quadratic Graphs \+ 3.3 Quadratic Forms \+ 3.4 Roots and Factors

Central insight: Different algebraic forms of a quadratic reveal different properties of the same graph.

For example:

\\\[ \\begin{aligned} f(x)&=x^2-8x+12\\\\ &=(x-2)(x-6)\\\\ &=(x-4)^2-4 \\end{aligned} \\\]

The three expressions describe exactly the same parabola.

Step 1 — Video: Explain the standard, factorised and completed-square forms. Show how these reveal the graph's shape, roots, axis of symmetry and turning point.

Step 2 — Interactive: Display a quadratic graph alongside its three algebraic forms. Let students alter meaningful parameters and see how the graph and equivalent expressions respond together.

The emphasis should be on identifying what each representation makes immediately apparent, rather than simply manipulating coefficients.

Step 3 — Exam illustration:

Given

$f(x)=(x-2)(x-6),$

find its roots, turning point and axis of symmetry. Sketch the graph and write $f(x)$ in completed-square form.

Key misconceptions:

* Different algebraic expressions can represent exactly the same function.  
* The turning point is not necessarily a root.  
* Changing the leading coefficient affects the graph's orientation and steepness, not merely its vertical position.

Why combine? The original three topics are different perspectives on the same relationship. We already have a dedicated Roots and Intercepts card in Section 2, so we do not need to teach that fundamental relationship again.

Interactive priority: High.

### **Card 11\. Completing the Square**

Original: 3.5 Completing the Square

Central insight: Completing the square reveals a quadratic's turning point directly, making its maximum or minimum and graphical behaviour easier to understand.

Step 1 — Video: Explain the algebraic procedure and, crucially, when completing the square is more useful than factorising or the quadratic formula.

For example:

$2{x}^{2}-8x+3=2(x-2{)}^{2}-5$

The completed form reveals the minimum point $(2,-5)$.

Step 2 — Interactive: Use an interactive experience connecting the algebraic rearrangement to the graph's turning point.

The visual should help students understand why the completed-square expression identifies the vertex, not merely practise a sequence of symbolic steps.

Step 3 — Exam illustration:

Express

$f(x)=2{x}^{2}-8x+3$

in completed-square form. Hence find its minimum value and state its range.

Key misconceptions:

* Completing the square is not just another way to solve a quadratic equation.  
* The squared term cannot be negative, but its coefficient can change the function's behaviour.  
* When the coefficient of ${x}^{2}$ is not 1, the adjustment must account for that coefficient.

Why separate? This is a substantial algebraic technique with its own reasoning and applications. It deserves more than a brief explanation inside the previous card.

We have already been developing dedicated completing-the-square experiences elsewhere in Puckle. I would reuse the relevant existing card or interactive experience, rather than independently designing the same mathematical lesson again for this section.

Interactive priority: High — reuse existing work.

### **Card 12\. Discriminant and Parameters**

Combines: 3.6 The Discriminant \+ 3.7 Quadratic Parameters

Central insight: The discriminant tells us how many real roots a quadratic has, while changing its parameters can alter whether and where the graph meets the x-axis.

Step 1 — Video: Explain the discriminant

$\Delta ={b}^{2}-4ac$

and connect positive, zero and negative values to two distinct real roots, one repeated real root and no real roots.

Step 2 — Interactive: Change a parameter in a quadratic and watch its graph approach, touch or move away from the x-axis, while the discriminant changes accordingly.

This should connect an algebraic condition to a visible graphical event.

Step 3 — Exam illustration:

For

${x}^{2}-6x+k=0,$

find the values of $k$ for which the equation has:

(a) two distinct real roots;

(b) one repeated real root;

(c) no real roots.

The key threshold is $k=9$.

Key misconceptions:

* A negative discriminant means no real roots, not necessarily no roots of any kind.  
* A repeated root is one distinct x-intercept, even though its multiplicity is two.  
* Finding the number of real roots does not require calculating the roots themselves.

Why combine? Parameter questions are often applications of the discriminant. Separating these would risk producing one card teaching a rule and another merely applying that same rule.

Interactive priority: Very high.

### **Section 3 assessment**

Four cards should be sufficient. The main benefit of this grouping is avoiding three overlapping explanations of quadratic graphs, roots and algebraic forms while retaining the substantial techniques of completing the square and discriminant analysis.

I would not reduce this to three cards. Combining the discriminant with completing the square would leave too much important reasoning inside one experience.

# **3\. Section 4 — Polynomial Functions**

6 original topics → 4 cards

Here I would make a stronger distinction between graphical understanding and algebraic techniques.

Cubic behaviour and repeated roots provide excellent opportunities for interactive learning. The Factor Theorem, polynomial division and polynomial identities need more explicit algebraic practice.

### **Card 13\. Cubic and Polynomial Graphs**

Combines: 4.1 Cubic Graphs \+ 4.5 Polynomial Behaviour

Central insight: A polynomial's degree, leading coefficient and roots help determine the overall shape and behaviour of its graph.

Step 1 — Video: Explain typical cubic shapes, end behaviour, intercepts and how degree and leading coefficient influence graphical behaviour.

Step 2 — Interactive: Explore different cubic graphs, including examples with one or three distinct real roots. Investigate how changing a leading coefficient or root position affects the shape.

The graph should make end behaviour particularly clear without automatically changing scale in ways that hide the mathematical change.

Step 3 — Exam illustration:

Sketch

$f(x)=(x+1)(x-2)(x-4).$

Identify its x-intercepts, y-intercept and end behaviour.

Key misconceptions:

* A cubic does not necessarily have three distinct real roots.  
* The leading coefficient influences which direction the graph travels at either end.  
* A higher-degree function can have several turning points, but not an arbitrary number.

Why combine? Polynomial behaviour generalises the graphical ideas introduced through cubics. We can use cubic examples as the main teaching vehicle, with brief comparisons to even-degree polynomials.

We should not duplicate detailed derivative-based curve sketching, which belongs in the Calculus topic.

Interactive priority: High.

### **Card 14\. Repeated Roots**

Original: 4.4 Repeated Roots

Central insight: The multiplicity of a root influences how the graph behaves as it meets the x-axis.

For example:

$f(x)=(x-1{)}^{2}(x+2)$

has a repeated root at $x=1$.

Step 1 — Video: Explain root multiplicity, including why even multiplicities make the graph touch the axis without changing sign, whereas odd multiplicities involve crossing it.

Step 2 — Interactive: Change the multiplicity of a root and observe the graph changing from crossing to touching, including flatter behaviour near higher-multiplicity roots.

Step 3 — Exam illustration:

Given

$f(x)=(x-1{)}^{2}(x+2),$

state its roots and their multiplicities. Sketch the graph, showing how it behaves at each intercept.

Key misconceptions:

* A repeated root does not mean two different x-intercepts.  
* A graph touching the x-axis is still reaching a root.  
* An odd-multiplicity root can have a flattened crossing; not every crossing looks like a straight line.

Why separate? This is a distinctive and counterintuitive graphical idea. It is easily lost inside a general treatment of cubic graphs and has a clear interactive discovery.

Interactive priority: Very high.

### **Card 15\. Factor Theorem and Division**

Combines: 4.2 The Factor Theorem \+ 4.3 Polynomial Division

Central insight: Knowing one root of a polynomial allows us to identify a factor, reduce the polynomial's degree and find its remaining roots.

Step 1 — Video: Explain the Factor Theorem, its relationship to remainders, and how to test candidate roots.

Step 2 — Video: Demonstrate polynomial division, showing how dividing by a known linear factor produces a lower-degree polynomial that is easier to solve.

Step 3 — Exam illustration:

Given

$P(x)={x}^{3}-4{x}^{2}+x+6,$

(a) show that $(x-2)$ is a factor;

(b) divide by $(x-2)$;

(c) hence find all three roots.

Key misconceptions:

* $P(2)=0$ corresponds to the factor $(x-2)$, not $(x+2)$.  
* A factor with zero remainder is different from a divisor producing a non-zero remainder.  
* Knowing one root of a cubic does not mean the remaining roots have already been found.

Why combine? These two techniques naturally form a single exam-solving process. Factor testing produces the divisor; polynomial division reduces the problem.

I recommend a video rather than a new interactive because the central assessed skill is carrying out and understanding the algebraic procedure. We can reference the earlier roots-and-factors interactive experience without rebuilding it.

### **Card 16\. Polynomial Identities**

Original: 4.6 Polynomial Identities

Central insight: An identity is true for every permitted value of the variable, not merely for the solutions of a particular equation.

Step 1 — Video: Explain the distinction between an identity and an equation, using polynomial expansion to demonstrate equality of expressions.

Step 2 — Video: Show how to compare coefficients of corresponding powers of $x$ to determine unknown constants.

Step 3 — Exam illustration:

Given the identity

$(x+a)(2x-3)\equiv 2{x}^{2}+bx+12,$

find $a$ and $b$.

Key misconceptions:

* An identity is not something we solve for a particular $x$.  
* Matching one numerical value does not prove two polynomials are identical.  
* Coefficients must be compared after expressions are correctly expanded and collected.

Why separate? Polynomial identities involve a different type of algebraic reasoning from finding roots or dividing polynomials. They are important for algebraic fluency, but do not justify an artificial interactive visual.

### **Section 4 assessment**

I recommend four cards because there are four distinct learning purposes: understand polynomial shapes, recognise multiplicity, reduce and solve polynomials, and reason using identities.

The strongest interactive opportunities are the first two. The final two are better treated as carefully explained algebraic techniques with worked exam solutions.

# **4\. Section 5 — Graph Transformations**

5 original topics → 3 cards

I consider this one of the highest-priority sections for interactive development.

Students can memorise transformation rules without understanding why they work. The most important misconception is the difference between modifying a function's input and modifying its output.

I recommend three cards, each with a distinct mathematical focus.

### **Card 17\. Graph Translations**

Combines: 5.1 Vertical Shifts \+ 5.2 Horizontal Shifts

Central insight: Changing the output of a function moves its graph vertically; changing the input moves it horizontally, often in the opposite direction to what students initially expect.

Step 1 — Video: Explain the difference between

$f(x)+aandf(x+a).$

Show why a positive value added inside the function shifts the graph left, whereas a positive value added outside shifts it up.

Step 2 — Interactive: Allow students to translate a parent graph horizontally or vertically and observe the corresponding expression change.

A key activity would involve predicting a graph's movement before applying a change to the expression.

Step 3 — Exam illustration:

The point $(1,4)$ lies on $y=f(x)$.

Given

$g(x)=f(x+3)-2,$

describe the transformation and find the corresponding point on $g$.

Key misconceptions:

* $f(x+3)$ shifts the graph left, not right.  
* $f(x)+3$ and $f(x+3)$ do not describe the same transformation.  
* Translating a graph changes its coordinates, but not its underlying shape.

Why combine? Horizontal and vertical translations are best understood through direct comparison, because the difference between modifying the input and output is the central insight.

Interactive priority: Very high.

### **Card 18\. Reflections and Scaling**

Combines: 5.3 Reflections \+ 5.4 Stretches

Central insight: Multiplying the input or output changes a graph's scale and possibly its orientation. Input changes act horizontally, while output changes act vertically.

Step 1 — Video: Explain the four important relationships:

\\\[ \\begin{aligned} \-f(x)& &&\\text{reflection in the x-axis}\\\\ f(-x)& &&\\text{reflection in the y-axis}\\\\ af(x)& &&\\text{vertical scaling}\\\\ f(bx)& &&\\text{horizontal scaling} \\end{aligned} \\\]

Explain why horizontal scaling uses the reciprocal factor, and how negative scale factors introduce reflections.

Step 2 — Interactive: Students alter input and output scale factors and observe stretching, compression and reflections.

They should directly compare transformations such as $2f(x)$ and $f(2x)$, or $-f(x)$ and $f(-x)$.

Step 3 — Exam illustration:

The point $(6,4)$ lies on $y=f(x)$.

Find the corresponding point on

$g(x)=-2f(3x).$

Explain both transformations.

Key misconceptions:

* $f(2x)$ compresses the graph horizontally by a factor of $1/2$, not stretches it by 2\.  
* $-f(x)$ and $f(-x)$ reflect the graph in different axes.  
* A reflection can leave a graph unchanged if it already has the relevant symmetry.

Why combine? Reflection and stretching are closely related mathematically: a negative scaling factor introduces a reflection. Teaching them together makes this relationship explicit.

Interactive priority: Very high.

### **Card 19\. Combined Transformations**

Original: 5.5 Combined Transformations

Central insight: Multiple transformations must be interpreted systematically because their order can affect the final graph.

Step 1 — Video: Show how to work from a parent function to a transformed function such as

$g(x)=2f(x-3)+1.$

Explain how individual coordinates change, rather than relying entirely on memorised transformation rules.

Step 2 — Interactive: Build a transformed graph through a short sequence of changes. Compare the resulting algebraic expression with the final coordinates.

The experience should reveal why different orders of transformation can produce different outcomes.

Step 3 — Exam illustration:

Describe the transformations taking $y=f(x)$ to

$y=2f(x-3)+1.$

If $(1,2)$ lies on the original graph, determine its transformed coordinates.

Key misconceptions:

* Transformations cannot always be rearranged without changing the result.  
* An expression such as $f(2x+4)$ needs careful interpretation of the factor inside the function.  
* It is safer to track what happens to coordinates than to apply memorised rules without checking them.

Why separate? Understanding individual transformations does not automatically mean students can combine them correctly. This is a genuine exam skill requiring integration and transfer.

Interactive priority: High.

### **Section 5 assessment**

Three cards are appropriate, and I would not reduce this section further.

Importantly, these three cards could use one shared interactive graph-transformation environment, with different learning activities and challenges. We don't need to develop three completely separate mathematical engines.

The final card builds on the first two and tests whether students can apply the relationships rather than merely recognise individual changes.

# **5\. Section 6 — Combining and Reversing Functions**

4 original topics → 3 cards

I think this is an especially important section to organise carefully.

There are three separate ideas:

* A function's output can become another function's input.  
* A function must satisfy particular conditions to have an inverse with the declared domain and codomain.  
* An inverse can be found algebraically and verified through composition.

The third is precisely the type of card you described earlier, where two short videos may be better than an interactive.

### **Card 20\. Composite Functions**

Original: 6.1 Composite Functions

Central insight: Function composition passes the output of one function into another, and changing the order generally changes the result.

Step 1 — Video: Explain $f(g(x))$, using simple examples to show that the inner function acts first.

Step 2 — Interactive: Students follow an input through two functions, observing the intermediate output and final result.

Compare $f(g(x))$ with $g(f(x))$, including cases where the domain restricts which inputs are permitted.

Step 3 — Exam illustration:

Given

$f(x)=\sqrt{x},g(x)=x-3,$

find $f(g(x))$ and $g(f(x))$, stating the domain of each composite.

Key misconceptions:

* $f(g(x))$ generally differs from $g(f(x))$.  
* The notation means that $g$ acts first.  
* A composite can have a more restricted domain than either original function.

Interactive priority: Medium–high. An input–output chain is a useful way to make the order of composition visible, particularly before students work with nested algebraic expressions.

### **Card 21\. Invertibility and Inverse Graphs**

Combines: 6.2 One-to-One Functions \+ 6.4 Onto Functions \+ the graphical aspect of 6.3 Inverse Functions

Central insight: Reversing a function requires us to understand whether outputs uniquely identify inputs, and an inverse graph exchanges the roles of $x$ and $y$.

Step 1 — Video: Explain injective (one-to-one), surjective (onto) and bijective functions, using mappings and graphical examples.

An important detail is that onto depends on the declared codomain, not merely the curve's shape.

Step 2 — Interactive: Explore why reflecting a graph in $y=x$ produces its inverse relation, and why this reflection may fail to be a function.

A particularly useful example is $f(x)={x}^{2}$, comparing its full domain with the restricted domain $x\geq 0$.

Step 3 — Exam illustration:

Consider

\\\[ f:\\mathbb R\\to\\mathbb R,\\qquad f(x)=x^2. \\\]

(a) Explain whether it is injective, surjective or bijective.

(b) Describe how restricting its domain and codomain to $[0,\infty )$ changes the answer.

(c) Sketch the resulting inverse function.

Key misconceptions:

* One-to-one and onto do not mean the same thing.  
* A function can be onto without being one-to-one.  
* Swapping $x$ and $y$ does not automatically produce a valid inverse function over the original domain and codomain.  
* The inverse graph is a reflection in $y=x$, not the y-axis or x-axis.

Why combine? Invertibility provides a coherent purpose for understanding injectivity, surjectivity and bijectivity. The graphical experience then reveals why those conditions matter.

Interactive priority: Very high.

### **Card 22\. Finding and Verifying Inverses**

Algebraic aspect of 6.3 Inverse Functions

Central insight: An inverse function reverses the effect of the original function, which can be verified algebraically by composition.

Step 1 — Video: Find the inverse by writing $y=f(x)$, rearranging to make $x$ the subject, and then exchanging the variable names. Include necessary domain restrictions.

Step 2 — Video: Verify that the inverse is correct using

${f}^{-1}(f(x))=x$

and, where appropriate,

$f({f}^{-1}(x))=x.$

Use an example where simplification requires more than a single arithmetic operation.

Step 3 — Exam illustration:

Given

$f(x)=\frac{2x+1}{x-3},$

(a) find ${f}^{-1}(x)$;

(b) state the relevant restrictions;

(c) verify the inverse by composition.

Key misconceptions:

* ${f}^{-1}(x)$ does not mean $1/f(x)$.  
* Rearranging is not finished until the inverse is expressed as a function of its input.  
* The inverse and original function have corresponding domain and range restrictions.  
* Verification requires actual substitution and simplification, not simply stating that the functions cancel.

Why separate? This is primarily an algebraic manipulation skill. Once students have understood what an inverse is and when one exists, there is little educational benefit in forcing a graphical interaction into the rearrangement-and-verification procedure.

This preserves your original example of a single card consisting of two short teaching videos, followed by an exam question.

### **Section 6 assessment**

Three cards give us a coherent progression:

Composition → Invertibility → Algebraic inverse and verification.

I would be reluctant to merge the final two cards. Doing so would force the graphical meaning of an inverse, the injective/surjective distinction, algebraic rearrangement and algebraic verification into just two short teaching steps.

The separation also lets us prioritise interactive work where it has the greatest educational value.

# **6\. Section 7 — Other Function Families**

5 original topics → 5 cards

This is the one section where I recommend retaining the original number of cards.

Each family introduces mathematical behaviour that students need to recognise independently. Merging them would risk creating cards that introduce too many different ideas without adequately exploring any of them.

### **Card 23\. Rational Functions**

Original: 7.1 Rational Functions

Central insight: Rational functions can have excluded inputs, asymptotes and discontinuities that are not immediately apparent from their simplified algebraic form.

Step 1 — Video: Explain rational functions, denominator restrictions and the meaning of vertical and horizontal asymptotes.

Step 2 — Interactive: Explore how changing a rational function changes its graph, particularly near excluded inputs.

A particularly valuable comparison would be between a vertical asymptote and a removable discontinuity (a hole).

Step 3 — Exam illustration:

Given

$f(x)=\frac{x+1}{x-2},$

find its domain, intercepts and asymptotes, and sketch its graph.

As an extension, consider

$g(x)=\frac{{x}^{2}-1}{x-1}.$

Explain why its graph contains a hole even though the expression simplifies to $x+1$ for $x\ne 1$.

Key misconceptions:

* An excluded denominator value does not always produce a vertical asymptote.  
* Cancelling a factor does not necessarily restore an excluded value to the domain.  
* A graph can approach an asymptote arbitrarily closely without reaching it at the excluded input.

Why separate? This deserves its own card because the distinction between holes, asymptotes and valid inputs is conceptually demanding.

It also reinforces our earlier work on invalid solutions and the restrictions associated with algebraic manipulation.

Interactive priority: Very high.

### **Card 24\. Exponential Functions**

Original: 7.2 Exponential Functions

Central insight: Exponential functions describe multiplicative change, unlike linear functions, which describe additive change.

Step 1 — Video: Explain exponential functions of the form

$f(x)=a{b}^{x}$

and the roles of the initial value and growth factor. Contrast exponential growth and decay with linear change.

Step 2 — Interactive: Change the initial value and growth factor, observing how the graph responds.

Explore why a positive exponential function approaches zero without reaching it and why $b>1$ produces growth whereas $0<b<1$ produces decay.

Step 3 — Exam illustration:

A population is modelled by

$P(t)=300(1.08{)}^{t},$

where $t$ is measured in years.

Find its initial population, calculate the predicted population after two years, and explain what the factor $1.08$ means.

Key misconceptions:

* A growth factor of $1.08$ represents an 8% increase per time period, not an addition of 8\.  
* Exponential growth does not mean growth at a constant absolute rate.  
* For a positive exponential function, the horizontal asymptote at $y=0$ is approached but never reached.

Interactive priority: High.

### **Card 25\. Logarithmic Functions**

Original: 7.3 Logarithmic Functions

Central insight: Logarithms reverse exponentiation, and this inverse relationship explains the shape, domain and behaviour of logarithmic graphs.

Step 1 — Video: Explain the equivalence between logarithmic and exponential expressions.

For example:

\\\[ \\log\_2 8=3 \\quad\\Longleftrightarrow\\quad 2^3=8. \\\]

Introduce logarithmic equations and their domain restrictions.

Step 2 — Interactive: Compare exponential and logarithmic graphs, showing how reflection in $y=x$ exchanges their domains and ranges.

Students should investigate why logarithmic functions have a vertical asymptote and why their inputs must be positive in the real-number setting.

Step 3 — Exam illustration:

Sketch

$y={\log }_{2}(x-1)$

and solve

${\log }_{2}(x-1)=3.$

State the domain and explain how it affects which solutions are valid.

Key misconceptions:

* Logarithms are not simply another notation for division.  
* A logarithmic function cannot accept zero or negative real inputs.  
* Exponential and logarithmic functions are inverse functions, not merely graphs with similar shapes.  
* Algebraic solutions to logarithmic equations must still satisfy their domain restrictions.

Why separate from exponentials? Exponential and logarithmic functions have a strong shared visual relationship, but the algebraic meaning of logarithms and their domain restrictions deserve focused treatment.

We can reuse the same interactive environment with a different learning journey.

More extensive logarithmic laws and manipulation can also be covered in Puckle's algebra content rather than attempting to teach the entire subject inside one functions card.

Interactive priority: Very high.

### **Card 26\. Piecewise Functions**

Original: 7.4 Piecewise Functions

Central insight: A function can use different algebraic rules over different parts of its domain while still assigning exactly one output to each permitted input.

Step 1 — Video: Explain piecewise notation, how to evaluate a function by selecting the appropriate rule, and the importance of boundary conditions.

Step 2 — Interactive: Explore a piecewise function by changing the boundaries or the expressions defining its pieces.

Students should see how included and excluded endpoints determine whether the graph joins, has a jump, or contains a hole.

Step 3 — Exam illustration:

Given

\\\[ f(x)= \\begin{cases} x+1,\&x\<1,\\\\ x^2,\&x\\geq1, \\end{cases} \\\]

(a) sketch the graph;

(b) find $f(1)$;

(c) explain what happens to the graph at $x=1$.

Key misconceptions:

* Both expressions do not apply to every input.  
* A piecewise function is still a single function.  
* An open endpoint and a closed endpoint have different meanings.  
* The pieces do not necessarily join continuously.

Why separate? The challenge is interpreting multiple rules and their boundaries. This differs fundamentally from the repeated behaviour of periodic functions.

Interactive priority: High.

### **Card 27\. Periodic Functions**

Original: 7.5 Periodic Functions

Central insight: A periodic function repeats its output pattern over regular input intervals, and its algebraic parameters determine properties such as amplitude, period and position.

Step 1 — Video: Explain periodicity, the meaning of a period, and how parameters affect the graphs of sine and cosine functions.

Step 2 — Interactive: Change the amplitude, period, horizontal shift and vertical displacement of a trigonometric graph.

Students should predict and observe how changing the coefficient of $x$ changes the period.

Step 3 — Exam illustration:

For

$f(x)=2\sin (3x)-1,$

find its amplitude, period and range. Sketch the graph over two complete periods.

Key misconceptions:

* Increasing the coefficient of $x$ decreases the period.  
* Amplitude is not the same as the maximum value when the graph is vertically translated.  
* The period measures horizontal repetition, not the vertical distance between maximum and minimum values.

Why separate? Periodicity is a distinct mathematical property with important exam applications. Although it overlaps with graph transformations, students must also understand the underlying repeating structure.

Interactive priority: Very high.

### **Section 7 assessment**

I would keep all five cards.

There are opportunities for shared interactive resources, particularly for exponential and logarithmic functions, but this should not dictate how many educational cards we create.

We also need to avoid unnecessary duplication with other Puckle topics:

* More advanced logarithmic algebra belongs in the relevant Algebra cards.  
* Trigonometric identities and general trigonometry belong in the Trigonometry topic.  
* Limits, continuity and derivative-based analysis belong principally in Calculus.

The Functions and Graphs cards should concentrate on the defining properties, graphical relationships, relevant misconceptions and exam applications of each family.

# **7\. Section 8 — Functions in Problems**

5 original topics → 3 cards

This section should be different in character from the preceding ones.

Students have already learned individual functions, graphical relationships and algebraic methods. Here the emphasis is on translating information into functions, interpreting results and judging whether those results make sense.

I recommend three cards.

### **Card 28\. Building Functions**

Combines: 8.1 Building Functions \+ 8.2 Finding Parameters

Central insight: Information about a mathematical or real-world situation can be translated into constraints that determine an unknown function.

Step 1 — Video: Explain how information such as given points, roots, intercepts or turning points can be expressed algebraically to determine unknown parameters.

Step 2 — Interactive: Explore how different constraints progressively determine a function.

For example, specifying a quadratic's turning point identifies a family of possible curves, while an additional point determines the remaining parameter.

Step 3 — Exam illustration:

A quadratic function has a turning point at $(2,5)$ and passes through $(0,-3)$.

Find its equation.

Key misconceptions:

* A point on a graph supplies a condition that the function must satisfy.  
* One condition does not always determine a unique function.  
* Students need to select an appropriate algebraic form rather than always starting with the expanded polynomial.  
* The number of independent conditions matters when determining unknown parameters.

Why combine? Building a function and finding its parameters are parts of the same reasoning process: converting known information into algebraic conditions.

Interactive priority: High.

### **Card 29\. Comparing Functions in Context**

Original: 8.3 Comparing Functions

Central insight: Comparing two functions allows us to determine when two quantities are equal, when one exceeds the other, and what those relationships mean in a real situation.

Step 1 — Video: Explain how to formulate comparisons using equations and inequalities, especially in revenue, cost and profit problems.

Step 2 — Video: Work through a contextual comparison, interpreting intersections, intervals and restrictions on the input variable.

This would reuse concepts from Sections 1 and 2 rather than introducing a new graphical technique.

Step 3 — Exam illustration:

A company's revenue and cost functions, measured in hundreds of euros, are

$R(x)=18x-{x}^{2}$

and

$C(x)=8x+16,$

where $x\geq 0$ is the number of batches produced.

Determine the values of $x$ for which the company makes a profit, and interpret the result.

Key misconceptions:

* Solving $R(x)=C(x)$ finds break-even values, not the interval of profitability.  
* A mathematically valid solution may not be meaningful in the context.  
* The units and domain must be considered when interpreting results.

Why no new interactive? The graphical ideas have already been explored in our Intersections and Inequalities cards. Here the distinctive skill is applying those relationships to a context and interpreting the answer.

### **Card 30\. Models and Their Limits**

Combines: 8.4 Modelling with Functions \+ 8.5 Model Limitations

Central insight: A mathematical model is a representation based on assumptions. It may describe observed behaviour accurately within a certain range without making reliable predictions everywhere.

Step 1 — Video: Explain how functions model situations, the distinction between interpolation and extrapolation, and why variables, units, assumptions and meaningful domains matter.

Step 2 — Video: Compare models that agree reasonably well over a short interval but predict very different behaviour outside that interval.

Explain why mathematical accuracy in a calculation is not the same as reliability of the underlying prediction.

Step 3 — Exam illustration:

A population is modelled by

$P(t)=500(1.15{)}^{t}.$

The model is based on measurements over the first five years.

(a) Calculate its predicted population after 20 years.

(b) Explain why this prediction might be unreliable.

(c) Identify an assumption underlying the model.

Key misconceptions:

* A mathematically correct prediction is not necessarily realistic.  
* A model that fits existing measurements does not necessarily remain accurate indefinitely.  
* A function's mathematical domain can be larger than its meaningful domain in a real situation.

Why combine? Modelling and model limitations form a single coherent learning process: construct or use a model, interpret its predictions, and evaluate their validity.

Why no interactive? Graphical comparison could be useful, but the important assessment skill is explaining assumptions, restrictions and the reliability of conclusions. A good short video with clear graphical examples should achieve that purpose without introducing additional controls.

### **Section 8 assessment**

Three cards provide a sensible conclusion to Functions and Graphs.

They ask students to apply the concepts established earlier rather than learning another collection of isolated rules.

The distinction between the three cards is important:

* Building Functions: Translate information into algebra.  
* Comparing Functions: Use algebra and graphs to make decisions.  
* Models and Their Limits: Judge whether a mathematical conclusion is meaningful.

I would not reduce this to two cards because the reasoning involved in constructing a function is quite different from evaluating the reliability of a model.

# **8\. Final recommendations**

## **Full 30-card structure**

This is the complete proposed sequence, including the eight cards already agreed.

| \# | Card | Step 2 | Priority |
| ----- | ----- | ----- | ----- |
| Section 1 — Understanding Functions |  |  |  |
| 1 | Functions and Notation | Video | — |
| 2 | Domain and Range | Interactive | High |
| 3 | Sketching and Reading Graphs | Interactive | High |
| Section 2 — Equations and Graphs |  |  |  |
| 4 | Roots and Intercepts | Interactive / reuse | High |
| 5 | Solving Using Intersections | Interactive | High |
| 6 | Graphical Inequalities | Interactive | Very high |
| 7 | Absolute Value | Interactive | High |
| 8 | Valid and Extraneous Solutions | Interactive | Very high |
| Section 3 — Linear and Quadratic Functions |  |  |  |
| 9 | Linear Functions | Video | — |
| 10 | Quadratic Graphs and Forms | Interactive | High |
| 11 | Completing the Square | Interactive / reuse | High |
| 12 | Discriminant and Parameters | Interactive | Very high |
| Section 4 — Polynomial Functions |  |  |  |
| 13 | Cubic and Polynomial Graphs | Interactive | High |
| 14 | Repeated Roots | Interactive | Very high |
| 15 | Factor Theorem and Division | Video | — |
| 16 | Polynomial Identities | Video | — |
| Section 5 — Graph Transformations |  |  |  |
| 17 | Graph Translations | Interactive | Very high |
| 18 | Reflections and Scaling | Interactive | Very high |
| 19 | Combined Transformations | Interactive | High |
| Section 6 — Combining and Reversing Functions |  |  |  |
| 20 | Composite Functions | Interactive | Medium–high |
| 21 | Invertibility and Inverse Graphs | Interactive | Very high |
| 22 | Finding and Verifying Inverses | Video | — |
| Section 7 — Other Function Families |  |  |  |
| 23 | Rational Functions | Interactive | Very high |
| 24 | Exponential Functions | Interactive | High |
| 25 | Logarithmic Functions | Interactive | Very high |
| 26 | Piecewise Functions | Interactive | High |
| 27 | Periodic Functions | Interactive | Very high |
| Section 8 — Functions in Problems |  |  |  |
| 28 | Building Functions | Interactive | High |
| 29 | Comparing Functions in Context | Video | — |
| 30 | Models and Their Limits | Video | — |

Priority measures the expected educational value of an interactive experience, not the importance of the mathematical card itself.

## **How much interactive development is actually needed?**

Of the proposed 30 cards:

Interactive Step 2

# **23**

Cards, including reuse

Video-only Step 2

# **7**

Cards without interaction

I would not interpret that as a requirement to build 23 independent interactive systems.

A smaller number of reusable mathematical environments should support multiple experiences. The most promising overlaps are:

| Shared mathematical environment | Potential cards |
| ----- | ----- |
| Roots, factors and polynomial graphs | 4, 10, 12, 13, 14 |
| Intersections and inequalities | 5, 6, 29 |
| Graph transformations | 17, 18, 19 |
| Composition and inverse relationships | 20, 21, 25 |
| Exponential and logarithmic graphs | 24, 25 |

These are opportunities for reuse, not instructions to merge cards. Each card would still need its own learning journey, questions and intended discovery.

## **The misconceptions I would particularly protect**

Across the remaining sections, I think the most valuable conceptual difficulties to address interactively are:

1\. Equivalent representations: Why different expressions can describe exactly the same quadratic graph.

2\. Discriminants and root counts: Why a curve can have two, one or no real x-intercepts, and how parameter changes produce those cases.

3\. Repeated roots: Why some graphs cross the x-axis whereas others touch it without crossing.

4\. Input versus output transformations: Why $f(x+3)$ moves left, and why $f(3x)$ compresses the graph horizontally.

5\. Invertibility: Why reflecting a graph in $y=x$ does not always produce another function, and how domain restrictions resolve this.

6\. Rational-function restrictions: Why cancelling a factor does not restore a missing point, and why holes and asymptotes are different.

7\. Exponential and logarithmic relationships: Why these functions are inverses, why their domains and ranges interchange, and how this affects valid solutions.

These sit alongside the two major misconceptions we explicitly prioritised in Section 2: operations on inequalities when the sign is unknown, and extraneous solutions introduced by squaring.

Together, they give Puckle a strong conceptual thread: students should understand not only how to manipulate algebraic expressions, but also what the operations mean, what they preserve, and when their conclusions are valid.

## **Two curriculum boundaries worth retaining**

There are two areas where I would avoid adding cards at this stage.

Calculus-based curve sketching should remain in the Calculus pathway, including detailed analysis using first and second derivatives. We can introduce polynomial shapes and turning points here without duplicating derivative methods.

Limits and continuity also appear in the existing Higher Level functions syllabus, though they were not a distinct topic in our original 44-item framework. I would explicitly account for them in the Calculus curriculum rather than silently treat the Piecewise Functions card as sufficient coverage.

Ordinary level and Higher level

Similarly, substantial logarithmic manipulation, the Conjugate Root Theorem and advanced trigonometric identities can be taught through their appropriate connected topics.

## **Overall conclusion**

I recommend adopting this 30-card framework as the working proposal for Puckle's Functions and Graphs topic.

The reduction from 44 to 30 is substantial without being arbitrary. The cards are focused enough for short videos and exam questions, and the proposed interactions are concentrated on relationships that students can genuinely struggle to understand through algebra alone.

The recommendation also preserves the decisions made for Sections 1 and 2\. I would leave those eight cards unchanged, with the possible exception we already identified: Card 3, Sketching and Reading Graphs, may eventually warrant splitting if its actual exam-question coverage proves too broad.

This is now a proposed card-level curriculum structure, not yet a set of approved individual interactive experience specifications. The next educational design phase can take each interactive card through the Discover and Design process in our two guides, with its exact central interaction and student journey developed separately.

