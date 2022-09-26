export default class Marking {

  constructor(isEnabled = false, isSuppressed = false) {
    this._isEnabled = isEnabled;
    this._isSuppressed = isSuppressed;
  }

  /**
   * Returns whether marking is enabled
   * @returns {Boolean}
   */
  get isEnabled() {
    return this._isEnabled;
  }

  /**
   * Returns whether marking is suppressed
   * @returns {Boolean}
   */
  get isSuppressed() {
    return this._isSuppressed;
  }

}
