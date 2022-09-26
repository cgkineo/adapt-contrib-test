export default class Passmark {

  constructor({
    _isEnabled = true,
    _requiresPassedSubsets = false,
    _score = 100,
    _correctness = 100,
    _isScaled = true
  } = {}) {
    this._isEnabled = _isEnabled;
    this._score = _score;
    this._correctness = _correctness;
    this._isScaled = _isScaled;
  }

  /**
   * Returns whether the passmark is required
   * @returns {Boolean}
   */
  get isEnabled() {
    return this._isEnabled;
  }

  /**
   * Returns whether the subsets need to be passed
   * @returns {Boolean}
   */
  get requiresPassedSubsets() {
    return this._requiresPassedSubsets;
  }

  /**
   * Returns the score required for passing
   * @returns {Number}
   */
  get score() {
    return this._score;
  }

  /**
   * Returns the correctness required for passing
   * @returns {Number}
   */
  get correctness() {
    return this._correctness;
  }

  /**
   * Returns whether the `score` is to be used as a percentage
   * @returns {Boolean}
   */
  get isScaled() {
    return this._isScaled;
  }

}
