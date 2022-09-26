import Attempt from './Attempt';

export default class Attempts {

  constructor(limit = 1) {
    this._limit = limit === 'infinite' ? -1 : limit;
    this._used = 0;
    this._history = [];
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
      const attempt = new Attempt();
      attempt.restore(state);
      return attempt;
    });
  }

  /**
   * Reset attempts
   * @todo Should `used` and/or `_history` ever be reset? Not currently called in `TestSet`
   */
  /*
  reset() {
    this._used = 0;
    this._history = [];
  }
  */

  /**
   * Returns the number of attempts allowed
   * @todo allow "infinite" as before? Think we should restrict this to number only as per AAT.
   * @returns {Number}
   */
  get limit() {
    return this._limit;
  }

  /**
   * Returns the number of attempts used
   * @returns {Number}
   */
  get used() {
    return this._used;
  }

  /**
   * Returns the number of attempts remaining
   * @returns {Number}
   */
  get remaining() {
    return this.limit - this.used;
  }

  /**
   * Returns whether there are an infinite number of attempts
   * @returns {Boolean}
   */
  get isInfinite() {
    return this.limit <= 0;
  }

  /**
   * Returns whether there are attempts remaining
   * @todo Return false if completed and passed as before? Not sure why this would be needed.
   * @returns {Boolean}
   */
  get hasRemaining() {
    return this.isInfinite || this.remaining > 0;
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
    return this._history[this.history.length - 1];
  }

  /**
   * Returns the state to save to offlineStorage
   * @returns {Array}
   */
  get saveState() {
    return [
      // due to history entries, this has to be a nested array for serializer
      [ this._used ],
      this.history.map(attempt => attempt.saveState)
    ];
  }

}
