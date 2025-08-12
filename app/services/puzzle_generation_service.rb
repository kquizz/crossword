class PuzzleGenerationService
  def initialize(options = {})
    @algo = options[:algo] || "by valid word count"
    @default_grid = options[:grid]
    @title = options[:title]
    @difficulty = options[:difficulty]
    @description = options[:description]
    @logger = options[:logger]
    @numbering = options[:numbering]

    @pattern_results_cache = {}

    raise "Default grid parameter is required" unless @default_grid.present?
    raise "Numbering parameter is required" unless @numbering.present?

    @default_grid = JSON.parse(@default_grid) if @default_grid.is_a?(String)
    @numbering = JSON.parse(@numbering) if @numbering.is_a?(String)

    if @title.blank? || @difficulty.blank?
      raise ArgumentError, "Title and difficulty are required."
    end

    @word_info = extract_word_info(@default_grid, @numbering)
    if @word_info.empty?
      raise "No valid words found in the grid with the provided numbering."
    end

    word_lengths = @word_info.map { |w| w[:length] }.uniq

    @words_list = Clue.where(length: word_lengths)
          .pluck(:answer)
          .uniq
          .group_by { |answer| answer.length }

    missing_lengths = word_lengths.select { |len| !@words_list.key?(len) || @words_list[len].empty? }
    unless missing_lengths.empty?
      raise "No clues found with length(s): #{missing_lengths.join(', ')}"
    end


    generate
  end


  def generate
    # Logic to generate a puzzle based on the selected algorithm
    case @algo
    when "by valid word count"
      generate_recursively_by_word_list_count(@word_info, @default_grid, Set.new, @logger)
    when "by difficulty"
      generate_by_difficulty
    else
      raise "Unknown generation algorithm: #{@algo}"
    end
  end

  def generate_recursively_by_word_list_count(word_info, grid, used_words, logger = nil)
    # Update Grid display in logger
    grid_str = grid.map { |row| row.map { |cell| cell.nil? ? "." : cell }.join(" ") }.join("\n")
    logger.update_message(grid_str) if logger

    # Success condition: no more words to place
    return { grid: grid } if word_info.empty?

    # The most constricted word's word count, per valid word list
    word_info.select { !_1.key?(:best_answer) }.each do |word|
      best = get_best_word_and_score(word, word_info, grid, used_words, logger)
      word[:best_answer] = best[:word]
      word[:score] = best[:score]
      word[:remaining_word_count] = get_valid_words(get_word_from_grid(word, grid), used_words).size
    end

    # Sort words by score (most constricted first)
    sorted_words = word_info.sort_by { |w| w[:remaining_word_count] }

    # Pick the most constricted word
    current_word = sorted_words.first
    candidates = get_valid_words(get_word_from_grid(current_word, grid), used_words)

    # Try each candidate for this word
    candidates.sort.each_with_index do |candidate, idx|
      # Shallow copy state (sufficient for arrays/hashes of primitives)
      new_word_info = word_info.map(&:dup)
      new_grid = grid.map(&:dup)
      new_used_words = used_words.dup

      # Place candidate
      target_word = new_word_info.find { |w| w[:number] == current_word[:number] && w[:direction] == current_word[:direction] }

      # Fill grid
      target_word[:cells].each_with_index do |(row, col), idx|
        new_grid[row][col] = candidate[idx]
      end
      new_used_words << candidate

      iw = intersecting_words(new_word_info, target_word)

      # Remove this word from word_info
      new_word_info.delete(target_word)

      ret = generate_recursively_by_word_list_count(new_word_info, new_grid, new_used_words, logger)
      return ret unless ret == -1
      # If failed, try next candidate
    end
    # If all candidates fail, backtrack
    # p 'Backtracking...'
    -1
    end

  def get_valid_words(pattern, used_words = Set.new)
    @pattern_results_cache ||= {}
    cache_key = pattern

    unless @pattern_results_cache.key?(cache_key)
      regex = Regexp.new("^#{pattern.gsub('_', '.')}$")
      @pattern_results_cache[cache_key] = @words_list[pattern.length].select { |word| word.match(regex) }
    end

    # Remove used words and return the list
    @pattern_results_cache[cache_key].reject { |word| used_words.include?(word) }
  end

  private def select_word(min_score_word, word_info, used_words, grid)
    new_grid = grid.map(&:dup)
    new_used_words = used_words.dup
    new_word_info = word_info.map(&:dup)

    unless min_score_word[:score] == 0
      # Fill grid with best answer for this word
      min_score_word[:cells].each_with_index do |(row, col), idx|
        grid[row][col] = min_score_word[:best_answer][idx]
      end

      used_words << min_score_word[:best_answer]

      intersecting_words(word_info, min_score_word).each do |word|
        word.delete(:best_answer)
        word.delete(:score)
      end

      # Remove the answer from all word lists (prevent repeats)
      word_info.select { _1 != min_score_word }.each do |w|
        if w[:best_answer] == min_score_word[:best_answer]
          w.delete(:best_answer)
          w.delete(:score)
        end
      end

      # Remove this word from word_info
      word_info.delete(min_score_word)
    end
    [ new_word_info, new_used_words, new_grid ]
  end

  private def get_best_word_and_score(word, word_info, grid, used_words = Set.new, logger = nil)
    logger.update_message("Analyzing word: #{word[:number]} #{word[:direction]}") if logger
    intersecting = intersecting_words(word_info, word)
    main_word_pattern = get_word_from_grid(word, grid)

    intersecting_patterns = get_intersecting_patterns(intersecting, word, grid)

    best_score = 0
    best_word = nil

    word_list = @words_list[word[:length]] || []

    # Ensure word[:word_list] is initialized
    word_list = get_valid_words(main_word_pattern, used_words)

    word_list.each do |candidate|
      score = Float::INFINITY
      intersecting_patterns.each do |pat|
        idx = pat[:main_word_intersection_index] ? pat[:main_word_intersection_index] - 1 : nil
        if idx
          pattern = pat[:pattern].sub("$", candidate[idx])
        else
          pattern = pat[:pattern]
        end
        # Count how many words in the intersecting word list match the pattern
        pattern_regex = /^#{pattern.gsub('_', '.')}$/
        temp_score = pat[:word_list].count { |w| w.match(pattern_regex) }
        # We need to make the "best word" judgement, based on the words worst performing intersection
        if temp_score < score
          score = temp_score
        end
      end
      # We want to grab the Best word.
      if score > best_score
        best_score = score
        best_word = candidate
      end
    end

    { word: best_word, score: best_score }
  end

  private def extract_word_info(grid, numbering)
    height = grid.length
    width = grid[0].length
    results = []

    numbering.each do |key, number|
      row, col = key.split(",").map(&:to_i)

      # Across word
      if starts_across_word?(grid, row, col, width)
        length = 1
        cells = [ [ row, col ] ]
        c = col + 1
        while c < width && grid[row][c] != "#"
          length += 1
          cells << [ row, c ]
          c += 1
        end
        results << { location: [ row, col ], number: number, direction: "across", length: length, cells: cells }
      end

      # Down word
      if starts_down_word?(grid, row, col, height)
        length = 1
        cells = [ [ row, col ] ]
        r = row + 1
        while r < height && grid[r][col] != "#"
          length += 1
          cells << [ r, col ]
          r += 1
        end
        results << { location: [ row, col ], number: number, direction: "down", length: length, cells: cells }
      end
    end

    results
  end

  private def get_intersecting_patterns(intersecting, word, grid)
    intersecting.map do |iw|
      pattern = get_word_from_grid(iw, grid)
      overlap = iw[:cells] & word[:cells]
      idx = nil
      main_word_intersection_index = nil
      overlap.each do |row, col|
        idx = iw[:cells].index([ row, col ])
        main_word_idx = word[:cells].index([ row, col ])
        if main_word_idx
          main_word_intersection_index = main_word_idx + 1 # 1-based index for SQL
        end
        pattern[idx] = "$" if idx
      end

      word_list = iw[:word_list] || []
      { intersecting_word: iw,
        pattern: pattern,
        length: iw[:length],
        main_word_intersection_index: main_word_intersection_index,
        word_list: word_list }
    end
  end

  private def intersecting_words(word_info, target_word)
    target_cells = target_word[:cells].to_set
    word_info.select do |word|
      word != target_word && !(word[:cells].to_set & target_cells).empty?
    end
  end

  private   # Helper: does this cell start an across word?
    def starts_across_word?(grid, row, col, width)
      return false if grid[row][col] == "#"
      left_is_blocked = col == 0 || grid[row][col - 1] == "#"
      right_exists = col < width - 1 && grid[row][col + 1] != "#"
      left_is_blocked && right_exists
    end

    # Helper: does this cell start a down word?
    private def starts_down_word?(grid, row, col, height)
      return false if grid[row][col] == "#"
      top_is_blocked = row == 0 || grid[row - 1][col] == "#"
      bottom_exists = row < height - 1 && grid[row + 1][col] != "#"
      top_is_blocked && bottom_exists
    end

    private def get_word_from_grid(word, grid)
      word[:cells].map { |row, col| grid[row][col] || "_" }.join
    end
end
