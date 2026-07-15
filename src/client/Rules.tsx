/**
 * Rules & strategy for Oh Hell / To Hell and Back. A static, crawlable page
 * (served at /rules) — written to also work as SEO landing content, since the
 * game is better known online as "Oh Hell".
 */
export function Rules() {
  return (
    <div className="content-page">
      <a className="back-link" href="/">
        ← Back to the game
      </a>
      <h1 className="title">How to Play Oh Hell</h1>
      <p className="subtitle">
        The complete rules and strategy for <b>To Hell and Back</b>, our free online version of the
        classic trick-taking card game Oh Hell.
      </p>

      <section>
        <h2>What is Oh Hell?</h2>
        <p>
          Oh Hell (also known as Oh Heck, Up and Down the River, or Nomination Whist) is a
          trick-taking card game for 2–4 players where the goal isn't to take the <i>most</i>{' '}
          tricks — it's to take <b>exactly</b> the number you bid. Bid two and take two, you score.
          Bid two and take three, you lose points. That one twist makes every card matter, whether
          you're trying to win a trick or desperately trying to lose one.
        </p>
        <p>
          <b>To Hell and Back</b> is our take on the game: the hands climb from 1 card up to 10 and
          back down to 1 — down to hell and back again. Everyone plays from their own phone, so
          nobody can peek at your cards, and a shared screen can act as the table.
        </p>
      </section>

      <section>
        <h2>The basics</h2>
        <ul>
          <li>
            <b>Players:</b> 2–4, using a standard 52-card deck. Aces are high. You can fill empty
            seats with bots.
          </li>
          <li>
            <b>The hands:</b> a classic game is 19 hands. The first hand deals 1 card to each
            player, the next 2, and so on up to 10 — then back down: 9, 8, … all the way to a final
            1-card hand. (For a shorter game, the host can lower the peak — e.g. 1-up-to-5-and-back
            is 9 hands.)
          </li>
          <li>
            <b>Trump:</b> after each deal, the next card of the deck is flipped face-up. Its suit is
            trump for the whole hand. Any trump card beats any card of another suit.
          </li>
          <li>
            <b>Dealing:</b> the deal rotates left each hand, and the player left of the dealer bids
            first and leads the first trick.
          </li>
        </ul>
      </section>

      <section>
        <h2>Bidding</h2>
        <p>
          After looking at your cards, each player in turn bids how many tricks they think they'll
          take this hand — anywhere from zero up to the number of cards dealt. The dealer always
          bids last, with the advantage of hearing everyone else's bid first.
        </p>
        <p>
          <b>The hook rule (optional):</b> on the back half of the game (the 10-down-to-1 descent),
          the dealer may not bid a number that makes the total bids equal the number of tricks
          available. That guarantees somebody at the table is going to miss — someone always gets
          hooked.
        </p>
      </section>

      <section>
        <h2>Playing a hand</h2>
        <ul>
          <li>
            The first trick of each hand is led by the player to the left of the first bidder —
            two seats left of the dealer. (House rule: standard Oh Hell has the first bidder lead.)
          </li>
          <li>
            Everyone else must <b>follow suit</b> if they can. If you have no cards of the led suit,
            you may play anything — including a trump.
          </li>
          <li>
            The trick is won by the highest trump played, or if no trump was played, the highest
            card of the led suit.
          </li>
          <li>The trick's winner leads the next trick.</li>
        </ul>
      </section>

      <section>
        <h2>Scoring</h2>
        <p>
          When the hand is over, compare each player's tricks to their bid:
        </p>
        <ul>
          <li>
            <b>Made your bid exactly:</b> score <b>bid + 5</b> points. (Bid 3, took 3 → +8.)
          </li>
          <li>
            <b>Missed your bid</b> — over <i>or</i> under: lose <b>bid + 5</b> points. (Bid 3, took
            4 → −8.)
          </li>
        </ul>
        <p>
          Yes, that means going negative is easy, and a bold bid is a double-edged sword: bigger
          reward if you hit it, bigger fall if you don't. Highest total after the final 1-card hand
          wins.
        </p>
      </section>

      <section>
        <h2>Oh Hell strategy</h2>

        <h3>Bidding well is most of the game</h3>
        <ul>
          <li>
            <b>Count your sure winners first.</b> Aces, high trumps, and protected kings (a king
            with at least one other card in that suit) usually take tricks. Middle cards are the
            liars — a queen might win or might not, so don't bid on hope.
          </li>
          <li>
            <b>Short suits are trump opportunities.</b> A void or singleton in a side suit means
            you can trump in early. A small trump plus a void is often worth a trick.
          </li>
          <li>
            <b>Listen to the other bids.</b> If bids are running high, tricks will be contested and
            your marginal cards get worse. If everyone bids low, someone has to take the leftovers
            — possibly you, whether you want them or not.
          </li>
          <li>
            <b>Bidding zero is a real strategy,</b> especially on small hands with low cards. A
            confident zero is one of the safest bids in the game — but one accidental trick ruins
            it, so make sure you can duck every suit.
          </li>
          <li>
            <b>Use the dealer's seat.</b> Bidding last, you know exactly whether the hand is over-
            or under-bid. Under-bid hands (total bids &lt; tricks) mean spare tricks are floating
            around and will fall into someone's lap; over-bid hands mean a knife fight for every
            trick.
          </li>
        </ul>

        <h3>Playing to your number</h3>
        <ul>
          <li>
            <b>Made your bid already? Start dumping.</b> Shed your dangerous high cards on tricks
            that are already lost — throw the king when an ace is out there. The second half of a
            hand is often about aggressively losing.
          </li>
          <li>
            <b>Need tricks? Take them early.</b> Cash your aces before someone runs out of that
            suit and trumps them. Sure winners get less sure with every trick that passes.
          </li>
          <li>
            <b>Watch what people can't follow.</b> When a player discards or trumps, they're out of
            the led suit — remember it. In the 8-, 9-, and 10-card hands, tracking voids is the
            difference between a plan and a prayer.
          </li>
          <li>
            <b>Count the trumps.</b> There are 13; one is face-up on the deck. When trumps are
            exhausted, your remaining high cards in side suits become unbeatable.
          </li>
          <li>
            <b>Sabotage is legal.</b> If an opponent needs exactly one more trick, feeding them an
            unwanted extra one is just as good as denying them. Missed bids cost points either
            direction — use that.
          </li>
        </ul>

        <h3>The one-card hands</h3>
        <p>
          The opening and closing hands deal a single card: one trick, and your bid is simply
          "will my card win, or won't it?" Consider position (leading a middling card is very
          different from playing it last) and whether it's trump. It feels like a coin flip, but
          the ±6 swing on the final hand of a close game is where legends are made.
        </p>
      </section>

      <section>
        <h2>How To Hell and Back works online</h2>
        <ol>
          <li>One person creates a game and shares the 4-letter room code or QR code.</li>
          <li>
            Everyone joins from their own phone — the phone is your hand, so your cards stay
            private. No app to install; it runs in the browser.
          </li>
          <li>
            Optionally, leave the create-screen device unseated to use it as a shared table display
            for the middle of the table.
          </li>
          <li>Short a player? Add a bot from the lobby.</li>
        </ol>
      </section>

      <footer className="page-footer">
        <a href="/">Play To Hell and Back</a>
        <span aria-hidden="true"> · </span>
        <a href="/privacy">Privacy policy</a>
      </footer>
    </div>
  );
}
