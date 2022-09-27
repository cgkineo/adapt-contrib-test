import Attempt from './Attempt';

export default class Attempts {

  constructor({
    _limit = 1,
    _keepPassed = true,
    _keepHighestScore = true,
    _shouldStoreAttempts = false
  } = {}, test) {
    this._keepPassed = _keepPassed;
    this._keepHighestScore = _keepHighestScore;
    this._shouldStoreAttempts = _shouldStoreAttempts;
    this._limit = _limit === 'infinite' ? -1 : parseInt(_limit);
    this._used = 0;
    this._history = [];
    this._test = test;
  }

  /**
   * Increment attempts used
   */
  spend() {
    this._used++;
  }

  /**
   * Record the attempt
   * @param {Attempt} attempt
   */
  record(attempt) {
    if (!this._shouldStoreAttempts) {
      // Keep just the last attempt carrying forward passed and highest score as necessary
      const last = this.last;
      const highest = this.highestScored;
      if (this.keepPassed) attempt._isPassed = last?.isPassed || attempt.isPassed;
      const hasScoredHigher = (attempt.score < highest?.score || 0);
      if (this.keepHighestScore && hasScoredHigher) {
        attempt._score = highest.score;
        attempt._minScore = highest.minScore;
        attempt._maxScore = highest.maxScore;
        attempt._correctness = highest.correctness;
      }
      this._history.length = 0;
    }
    this._history.push(attempt);
  }

  /**
   * Restore attempts from previous session
   * @param {Array} data
   */
  restore(data) {
    // due to history entries, this has to be a nested array for serializer
    this._used = data[0][0];
    this._history = data[1].map(state => {
      const attempt = new Attempt(this._test);
      attempt.restore(state);
      return attempt;
    });
  }

  /**
   * Returns the number of attempts allowed
   * @returns {number}
   */
  get limit() {
    return this._limit;
  }

  /**
   * Returns the number of attempts used
   * @returns {number}
   */
  get used() {
    return this._used;
  }

  /**
   * Returns the number of attempts remaining
   * @returns {number}
   */
  get remaining() {
    return this.limit - this.used;
  }

  /**
   * Returns whether there are an infinite number of attempts
   * @returns {boolean}
   */
  get isInfinite() {
    return this.limit <= 0;
  }

  /**
   * Returns whether there are attempts remaining
   * @returns {boolean}
   */
  get hasRemaining() {
    return (this.isInfinite || this.remaining > 0);
  }

  /**
   * Returns the history of attempts
   * @returns {[Attempt]}
   */
  get history() {
    return this._history;
  }

  /**
   * Returns the last completed attempt
   */
  get last() {
    return this._history[this.history.length - 1] ?? null;
  }

  /**
   * Returns the attempt with the highest score
   */
  get highestScored() {
    return this.history.reduce((highestAttempt, attempt) => (attempt.score > highestAttempt?.score || Number.MIN_SAFE_INTEGER) ? attempt : highestAttempt, null);
  }

  /**
   * Returns whether to keep any passed state
   * @returns {boolean}
   */
  get keepPassed() {
    return this._keepPassed;
  }

  /**
   * Returns whether to keep the highest score
   * @returns {boolean}
   */
  get keepHighestScore() {
    return this._keepHighestScore;
  }

  get wasPassed() {
    const isPassed = this.keepPassed
      ? this.history.some(attempt => attempt.isPassed)
      : this.last?.isPassed;
    return isPassed ?? false;
  }

  get wasComplete() {
    return this.last?.isComplete;
  }

  get minScore() {
    const minScore = this.keepHighestScore
      ? this.highestScored?.minScore
      : this.last?.minScore;
    return minScore ?? 0;
  }

  get maxScore() {
    const maxScore = this.keepHighestScore
      ? this.highestScored?.maxScore
      : this.last?.maxScore;
    return maxScore ?? 0;
  }

  get score() {
    const score = this.keepHighestScore
      ? this.highestScored?.score
      : this.last?.score;
    return score ?? 0;
  }

  get correctness() {
    const correctness = this.keepHighestScore
      ? this.highestScored?.correctness
      : this.last?.correctness;
    return correctness ?? 0;
  }

  /**
   * Returns the state to save to offlineStorage
   * @todo Save only last attempt to prevent filling up suspend data
   * @returns {Array}
   */
  get saveState() {
    return [
      // Due to history entries, this has to be a nested array for serializer
      [
        this._used
      ],
      this.history.map(attempt => attempt.saveState)
    ].filter(Boolean);
  }

}
