export default class Attempt {

  /**
   * @param {Asessment} test The test set of the attempt
   */
  constructor(test) {
    this._test = test;
    this._isInSession = false;
    this.reset();
  }

  /**
   * Start the attempt
   */
  start() {
    this._isInSession = true;
    this._isInProgress = true;
  }

  /**
   * Update the attempt
   */
  update() {
    this._minScore = this._test.minScore;
    this._maxScore = this._test.maxScore;
    this._score = this._test.score;
    this._correctness = this._test.correctness;
  }

  /**
   * End the attempt
   */
  end() {
    this._isInProgress = false;
    this._isComplete = true;
    this._isPassed = this._test.isPassed;
  }

  /**
   * Restore attempt from previous session
   * @todo Should scores only be saved/restored for completed attempts?
   * @param {Array} data
   */
  restore(data) {
    this._isInProgress = (data[0] === 1);
    this._minScore = data[1];
    this._maxScore = data[2];
    this._score = data[3];
    this._correctness = data[4];
    this._isComplete = (data[5] === 1);
    this._isPassed = (data[6] === 1);
  }

  /**
   * Reset the attempt
   */
  reset() {
    this._isInProgress = false;
    this._minScore = 0;
    this._maxScore = 0;
    this._score = 0;
    this._correctness = 0;
    this._isComplete = false;
    this._isPassed = false;
  }

  /**
   * Returns whether the attempt is in session
   * @returns {Boolean}
   */
  get isInSession() {
    return this._isInSession;
  }

  /**
   * Set whether the attempt is in session
   * @param {Boolean} value
   */
  set isInSession(value) {
    this._isInSession = value;
  }

  /**
   * Returns whether the attempt is in progress
   * @returns {Boolean}
   */
  get isInProgress() {
    return this._isInProgress;
  }

  /**
   * Returns the minimum score
   * @returns {Number}
   */
  get minScore() {
    return this._minScore;
  }

  /**
   * Returns the maximum score
   * @returns {Number}
   */
  get maxScore() {
    return this._maxScore;
  }

  /**
   * Returns the score
   * @returns {Number}
   */
  get score() {
    return this._score;
  }

  /**
   * Returns the number of correctly answered questions
   * @returns {Number}
   */
  get correctness() {
    return this._correctness;
  }

  /**
   * Returns whether the attempt is completed
   * @returns {Boolean}
   */
  get isComplete() {
    return this._isComplete;
  }

  /**
   * Returns whether the attempt is passed
   * @returns {Boolean}
   */
  get isPassed() {
    return this._isPassed;
  }

  /**
   * Returns the state to save to offlineStorage
   * @todo Should the associated trackingIds/questions be saved in case we want to know which models were used?
   * @returns {Array}
   */
  get saveState() {
    return [
      this.isInProgress ? 1 : 0,
      this.minScore,
      this.maxScore,
      this.score,
      this.correctness,
      this.isComplete ? 1 : 0,
      this.isPassed ? 1 : 0
    ];
  }

}
