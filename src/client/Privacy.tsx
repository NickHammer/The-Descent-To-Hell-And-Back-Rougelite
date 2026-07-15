/** Privacy policy page, served at /privacy. Required for AdSense approval. */
export function Privacy() {
  return (
    <div className="content-page">
      <a className="back-link" href="/">
        ← Back to the game
      </a>
      <h1 className="title">Privacy Policy</h1>
      <p className="subtitle">
        For <b>To Hell and Back</b>, an online Oh Hell card game. Last updated: July 14, 2026.
      </p>

      <section>
        <h2>The short version</h2>
        <p>
          To Hell and Back is a free browser game. There are no accounts, no sign-ups, and no
          passwords. We collect the minimum needed to run a game: the display name you type in and
          the results of finished games for the public leaderboard. We don't sell data.
        </p>
      </section>

      <section>
        <h2>What we store, and where</h2>
        <h3>On your device</h3>
        <ul>
          <li>
            <b>Your display name</b> is saved in your browser's local storage so you don't have to
            retype it. It never leaves your browser except to show it to the other players in your
            game.
          </li>
          <li>
            <b>Your current room code</b> is kept in session storage so you can rejoin your game if
            the page reloads. It's cleared when you close the tab.
          </li>
        </ul>
        <p>
          You can clear both at any time through your browser's site-data settings. We don't use
          tracking cookies.
        </p>
        <h3>On our server</h3>
        <ul>
          <li>
            <b>Live games</b> exist only in the server's memory while they're being played, and are
            deleted after the game ends or sits idle for a couple of hours.
          </li>
          <li>
            <b>Leaderboard results</b>: when a game with no bots finishes, we store each player's
            display name, score, and per-hand results so we can show the public leaderboard.
            Display names are chosen by players and shown publicly — don't use your real name if
            you don't want it displayed.
          </li>
          <li>
            <b>Standard connection logs</b> (such as IP addresses) may be kept briefly by the
            server and its hosting provider for security and debugging, as with virtually every
            website.
          </li>
        </ul>
      </section>

      <section>
        <h2>What we don't do</h2>
        <ul>
          <li>No accounts, emails, or passwords are collected.</li>
          <li>No data is sold or shared with data brokers.</li>
          <li>No third-party analytics or tracking cookies are in use today.</li>
        </ul>
      </section>

      <section>
        <h2>Advertising</h2>
        <p>
          We may show ads in the future to keep the game free. If we do, our advertising partners
          (such as Google) may use cookies or similar technologies to serve and measure ads, and —
          where required by law — you will be asked for consent before any advertising cookies are
          set. This policy will be updated before any ads go live.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>
          The game is a general-audience card game and does not knowingly collect personal
          information from children. The only free-text input is a display name; please don't enter
          personal information in it.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <ul>
          <li>Play under any display name you like — a nickname works fine.</li>
          <li>Clear your browser's site data to remove the locally stored name and room code.</li>
          <li>
            To ask about or request removal of a leaderboard entry, contact us at the address
            below.
          </li>
        </ul>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions or removal requests:{' '}
          <a href="mailto:nick.hammerstrom14@gmail.com">nick.hammerstrom14@gmail.com</a>
        </p>
      </section>

      <footer className="page-footer">
        <a href="/">Play To Hell and Back</a>
        <span aria-hidden="true"> · </span>
        <a href="/rules">Rules &amp; strategy</a>
      </footer>
    </div>
  );
}
