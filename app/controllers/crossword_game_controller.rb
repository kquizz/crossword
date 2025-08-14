
class CrosswordGameController < ApplicationController
  include CrosswordGameHelper

  before_action :load_puzzle, only: [ :play, :update_cell, :reset_puzzle ]

  def play
    if params[:id]
      @puzzle = Puzzle.find(params[:id])
    else
      @puzzle = Puzzle.last # Fallback to last puzzle if no ID provided
    end

    if @puzzle
      @grid = @puzzle.grid("play")  # This is the blank grid for user input
      @solution_grid = @puzzle.solution_grid  # This is needed for numbering calculation
      @clues = @puzzle.persisted? ? PuzzleClueService.load_clues_for_puzzle(@puzzle) : { across: [], down: [] }
      Rails.logger.info "🎯 Loaded #{@clues[:across].length} across clues and #{@clues[:down].length} down clues for puzzle #{@puzzle.id}: '#{@puzzle.title}'" if @puzzle.persisted?
    else
      @grid = generate_empty_grid(15, 15)
      @solution_grid = generate_empty_grid(15, 15)
      @clues = { across: [], down: [] }
    end
    @mode = "play"
  end

  def create
    @puzzle = Puzzle.new
    # Default to 15x15 for new puzzles, or use params if provided
    width = params[:width]&.to_i || 15
    height = params[:height]&.to_i || 15
    @grid = params[:grid] ? JSON.parse(params[:grid]) : generate_empty_grid(width, height)
    @solution_grid = @grid # In create mode, the grid is the solution grid
    @clues = { across: [], down: [] } # Empty clues for new puzzle
    @mode = "create"
  end

  def update_cell
    respond_to do |format|
      format.json do
        # Handle AJAX updates for cell values
        row = params[:row].to_i
        col = params[:col].to_i
        value = params[:value].to_s.upcase

        if @puzzle && valid_position?(row, col)
          grid = @puzzle.blank_grid
          grid[row][col] = value.empty? ? nil : value
          @puzzle.blank_grid = grid
          @puzzle.save
          render json: { success: true, value: value }
        else
          render json: { success: false, error: "Invalid position" }
        end
      end
    end
  end

  def reset_puzzle
    respond_to do |format|
      format.json do
        if @puzzle
          # Clear all cells in the blank grid
          height = @puzzle.height || 15
          width = @puzzle.width || 15
          blank_grid = Array.new(height) { Array.new(width) { nil } }

          # Preserve the blocked cells from the solution grid
          solution_grid = @puzzle.solution_grid
          if solution_grid
            height.times do |row|
              width.times do |col|
                if solution_grid[row] && solution_grid[row][col] == "#"
                  blank_grid[row][col] = "#"
                end
              end
            end
          end

          @puzzle.blank_grid = blank_grid
          @puzzle.save
          render json: { success: true }
        else
          render json: { success: false, error: "Puzzle not found" }
        end
      end
    end
  end

  def save_puzzle
    @puzzle = Puzzle.new(puzzle_params)
    if params[:grid]
      grid_data = JSON.parse(params[:grid])
      @puzzle.grid = grid_data
      @puzzle.width = grid_data.first&.length || 15
      @puzzle.height = grid_data.length || 15
    end

    if @puzzle.save
      redirect_to puzzle_path(@puzzle), notice: "Puzzle created successfully!"
    else
      @grid = @puzzle.solution_grid || generate_empty_grid
      @mode = "create"
      render :create
    end
  end

  def generate
    grid = params[:grid]
    title = params[:title] || "Generated Puzzle"
    numbering = params[:numbering]
    difficulty = params[:difficulty] || :medium
    description = params[:description] || "Generated puzzle"
    logger = InlinePercentLogger.new("Generating crossword grid")

    grid = JSON.parse(grid) if grid.is_a?(String)
    numbering = JSON.parse(numbering) if numbering.is_a?(String)

    solution = PuzzleGenerationService.new(
      grid: grid,
      numbering: numbering,
      title: title,
      difficulty: difficulty,
      description: description,
      logger: logger
    ).generate

    if solution && solution[:grid]
      puzzle = create_puzzle_from_grid(solution[:grid], numbering, title: title, difficulty: difficulty, description: description)
    else
      puzzle = nil
    end

    if puzzle && puzzle.persisted?
      respond_to do |format|
        format.html { redirect_to play_crossword_path(id: puzzle.id) }
        format.turbo_stream do
          render turbo_stream: turbo_stream.replace(
            "flash",
            partial: "shared/flash",
            locals: { type: :success, message: "Puzzle generated successfully!" }
          )
        end
      end
    else
      respond_to do |format|
        format.html { render json: { success: false, error: "Puzzle generation failed." }, status: :unprocessable_entity }
        format.turbo_stream do
          render turbo_stream: turbo_stream.replace(
            "flash",
            partial: "shared/flash",
            locals: { type: :error, message: "Puzzle generation failed." }
          )
        end
      end
    end

  rescue => e
    Rails.logger.error "Puzzle generation error: #{e.message}"
    respond_to do |format|
        format.html { render json: { success: false, error: "Puzzle generation failed." }, status: :unprocessable_entity }
        format.turbo_stream do
          render turbo_stream: turbo_stream.replace(
            "flash",
            partial: "shared/flash",
            locals: { type: :error, message: "Puzzle generation failed. #{e.message}" }
          )
        end
      end
  end

  # KMQ TODO: start by cacheing the patterns -> word list
  # get rid of the concept have a master word list, and query against it everytime
  # cache the results per pattern, and then use those cached results for future queries


  def generate_sql
    # Parse grid from JSON string if needed
    grid = params[:grid]
    og_grid = params[:grid]
    title = params[:title] || "Generated Puzzle"
    difficulty = params[:difficulty] || :medium
    description = params[:description] || "Generated puzzle"

    raise "Grid parameter is required" unless grid.present?
    raise "Numbering parameter is required" unless params[:numbering].present?
    if title.blank? || difficulty.blank?
      render json: { success: false, error: "Title and difficulty are required." }, status: :unprocessable_entity
      return
    end


    grid = JSON.parse(grid) if grid.is_a?(String)
    numbering = JSON.parse(params[:numbering])
    word_info = extract_word_info(grid, numbering)

    debugger

    used_words = Set.new
    loop do
      # Calculate best answer and score for each word
      word_info.select { !_1.key?(:best_answer) }.each do |word|
        best = get_best_word_and_score(word, word_info, grid, used_words)
        word[:best_answer] = best[:word]
        word[:score] = best[:score]
      end
      debugger

      # Find word with lowest score
      min_score_word = word_info.min_by { |w| w[:score] }
      break unless min_score_word # No words left

      if min_score_word[:score] == 0
        raise "No possible answer for word: \\#{min_score_word.inspect}"
      end

      # Fill grid with best answer for this word
      min_score_word[:cells].each_with_index do |(row, col), idx|
        grid[row][col] = min_score_word[:best_answer][idx]
      end

      used_words << min_score_word[:best_answer]

      intersecting_words(word_info, min_score_word).each do |word|
        word.delete(:best_answer)
        word.delete(:score)
      end

      # Remove this word from word_info
      word_info.delete(min_score_word)

      break if word_info.empty?
    end

    # At this point, grid is filled
    @solution_grid = grid

    puzzle = create_puzzle_from_grid(grid, numbering, title: title, difficulty: difficulty, description: description)

    # Redirect to play page for the new puzzle
    redirect_to play_crossword_path(id: puzzle.id)
  end

  def generate_old
    # Parse grid from JSON string if needed
    grid = params[:grid]
    og_grid = params[:grid]
    title = params[:title] || "Generated Puzzle"
    difficulty = params[:difficulty] || :medium
    description = params[:description] || "Generated puzzle"

    raise "Grid parameter is required" unless grid.present?
    raise "Numbering parameter is required" unless params[:numbering].present?
    if title.blank? || difficulty.blank?
      render json: { success: false, error: "Title and difficulty are required." }, status: :unprocessable_entity
      return
    end


    grid = JSON.parse(grid) if grid.is_a?(String)
    numbering = JSON.parse(params[:numbering])
    word_info = extract_word_info(grid, numbering)

    word_lengths = word_info.map { |w| w[:length] }.uniq
    words_list = Clue.where(length: word_lengths)
            .pluck(:answer)
            .uniq
            .group_by { |answer| answer.length }

    debugger

    word_info.each do |word|
      # why don't these have word_list
      word[:word_list] = words_list[word[:length]]
      raise "Word list not found for length #{word[:length]}" unless word[:word_list].present?
    end

    debugger

    used_words = Set.new
    word_count_threshold = 5
    score_threshold = 20

    total_words = word_info.size
    logger = InlinePercentLogger.new("Generating crossword grid")
    # ret = generate_recursively(word_info, grid, used_words, word_count_threshold, score_threshold, logger)
    ret = generate_recursively_by_word_list_count(word_info, grid, used_words, logger)

    if ret == -1
      render json: { success: false, error: "Failed to generate a valid crossword puzzle." }, status: :unprocessable_entity
      return
    end

    # At this point, grid is filled
    solution_grid = ret[:grid]

    puzzle = create_puzzle_from_grid(solution_grid, numbering, title: title, difficulty: difficulty, description: description)

    # Redirect to play page for the new puzzle
    redirect_to play_crossword_path(id: puzzle.id)
  end

  def generate_recursively_in_order_smarter(word_info, grid, used_words, logger = nil, iw = nil)
    return { grid: grid } if word_info.empty?

    word_info.select { !_1.key?(:best_answer) }.each do |word|
      best = get_best_word_and_score(word, word_info, grid, used_words, logger)
      word[:best_answer] = best[:word]
      word[:score] = best[:score]
      word[:remaining_word_count] = word[:word_list].count
    end

    grid_str = grid.map { |row| row.map { |cell| cell.nil? ? "." : cell }.join(" ") }.join("\n")
    logger.update_message(grid_str)

    sorted_words = word_info.sort_by { |w| [
      iw && iw.include?(w) ? 0 : 1,           # 0 if in iw, 1 otherwise
      w[:remaining_word_count] < 5 ? 0 : 1,   # 0 if < 5, 1 otherwise
      w[:score]
    ] }

    current_word = sorted_words.first
    # logger.update_message("")
    candidates = get_valid_words(current_word[:word_list], get_word_from_grid(current_word, grid), used_words)

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

      ret = generate_recursively_in_order_smarter(new_word_info, new_grid, new_used_words, logger)
      return ret unless ret == -1
      # If failed, try next candidate
    end
    # If all candidates fail, backtrack
    # p 'Backtracking...'
    -1
  end

  def generate_recursively_by_word_list_count(word_info, grid, used_words, logger = nil)
    return { grid: grid } if word_info.empty?

    word_info.select { !_1.key?(:best_answer) }.each do |word|
      best = get_best_word_and_score(word, word_info, grid, used_words, logger)
      word[:best_answer] = best[:word]
      word[:score] = best[:score]
      word[:remaining_word_count] = word[:word_list].count
    end

    word_info.each do |word|
      word[:word_list] = get_valid_words(word[:word_list], get_word_from_grid(word, grid), used_words)
      word[:remaining_word_count] = word[:word_list].count
    end

    grid_str = grid.map { |row| row.map { |cell| cell.nil? ? "." : cell }.join(" ") }.join("\n")
    logger.update_message(grid_str)

    sorted_words = word_info.sort_by { |w| w[:remaining_word_count] }

    current_word = sorted_words.first
    candidates = current_word[:word_list]

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

  def generate_recursively_in_order(word_info, grid, used_words, logger = nil)
    return { grid: grid } if word_info.empty?
    grid_str = grid.map { |row| row.map { |cell| cell.nil? ? "." : cell }.join(" ") }.join("\n")

    logger.update_message(grid_str)

    current_word = word_info.first
    candidates = get_valid_words(current_word[:word_list], get_word_from_grid(current_word, grid), used_words)

    # Try each candidate for this word
    candidates.each_with_index do |candidate, idx|
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


      # Remove this word from word_info
      new_word_info.delete(target_word)

      ret = generate_recursively_in_order(new_word_info, new_grid, new_used_words, logger)
      return ret unless ret == -1
      # If failed, try next candidate
    end
    # If all candidates fail, backtrack
    # p 'Backtracking...'
    -1
  end

  def generate_recursively(word_info, grid, used_words, word_count_threshold, score_threshold, logger = nil)
    return { grid: grid } if word_info.empty?
    grid_str = grid.map { |row| row.map { |cell| cell.nil? ? "." : cell }.join(" ") }.join("\n")

    logger.update_message(grid_str)

    word_info.select { !_1.key?(:best_answer) }.each do |word|
      best = get_best_word_and_score(word, word_info, grid, used_words, logger)
      word[:best_answer] = best[:word]
      word[:score] = best[:score]
      word[:remaining_word_count] = word[:word_list].count
    end

    # Partition words by thresholds
    constrained = word_info.select { |w| w[:remaining_word_count] < word_count_threshold }
    if constrained.any? && word_info.any? { _1[:score] < score_threshold }
      sorted_words = constrained.sort_by { |w| w[:score] }
    else
      sorted_words = word_info.sort_by { |w| [ w[:remaining_word_count], w[:score] ] }
    end

    # Pick the most constrained word
    target_word = sorted_words.pop
    candidates = get_valid_words(target_word[:word_list], get_word_from_grid(target_word, grid), used_words)

    # Try each candidate for this word
    candidates.each_with_index do |candidate, idx|
      # Shallow copy state (sufficient for arrays/hashes of primitives)
      new_word_info = word_info.map(&:dup)
      new_grid = grid.map(&:dup)
      new_used_words = used_words.dup

      # Place candidate
      target_word = new_word_info.find { |w| w[:number] == target_word[:number] && w[:direction] == target_word[:direction] }
      target_word[:best_answer] = candidate
      target_word[:score] = 1 # or actual score if you want

      # Fill grid
      target_word[:cells].each_with_index do |(row, col), idx|
        new_grid[row][col] = candidate[idx]
      end
      new_used_words << candidate

      # Remove candidate from other word lists
      new_word_info.each do |w|
        w[:word_list].delete(candidate)
        w[:word_list] -= new_used_words.to_a
        w[:remaining_word_count] = w[:word_list].count
        if w[:best_answer] == candidate && w != target_word
          w.delete(:best_answer)
          w.delete(:score)
        end
      end

      # Remove this word from word_info
      new_word_info.delete(target_word)

      # # Update progress logger and print grid
      # if logger
      #   total_words = logger.total || (new_word_info.size + 1)
      #   words_solved = total_words - new_word_info.size
      #   logger.message = "#{words_solved} out of #{total_words} Words solved"
      #   logger.update(words_solved)
      #   # Print grid below progress
      #   grid_str = new_grid.map { |row| row.map { |cell| cell.nil? ? "." : cell }.join(" ") }.join("\n")
      #   # Rails.logger.info("\n" + logger.message + "\n" + grid_str + "\n")
      # end

      # Recurse
      ret = generate_recursively(new_word_info, new_grid, new_used_words, word_count_threshold, score_threshold, logger)
      return ret unless ret == -1
      # If failed, try next candidate
    end
    # If all candidates fail, backtrack
    # p 'Backtracking...'
    -1
  end

  def select_word(min_score_word, word_info, used_words, grid)
    new_grid = grid.map(&:dup)
    new_used_words = used_words.dup
    new_word_info = word_info.map(&:dup)

    unless min_score_word[:score] == 0
      # Fill grid with best answer for this word
      min_score_word[:cells].each_with_index do |(row, col), idx|
        grid[row][col] = min_score_word[:best_answer][idx]
      end

      # grid.each do |row|
      #   puts row.map { |cell| cell.nil? ? "." : cell }.join(" ")
      # end

      used_words << min_score_word[:best_answer]

      intersecting_words(word_info, min_score_word).each do |word|
        word.delete(:best_answer)
        word.delete(:score)
      end

      # Remove the answer from all word lists (prevent repeats)
      word_info.select { _1 != min_score_word }.each do |w|
        w[:word_list].delete(min_score_word[:best_answer])
        w[:word_list] -= used_words.to_a
        w[:remaining_word_count] = w[:word_list].count
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


  # Given a filled grid and numbering, create a Puzzle and associate clues
  def create_puzzle_from_grid(grid, numbering, title: "Generated Puzzle", difficulty: :medium, description: "Generated puzzle")
    word_info = extract_word_info(grid, numbering)
    puzzle = Puzzle.new(title: title, difficulty: difficulty, description: description, width: grid.first.length, height: grid.length)
    puzzle.solution_grid = grid
    puzzle.blank_grid = grid.map { |row| row.map { |cell| cell == "#" ? "#" : nil } }
    puzzle.save!

    word_info.each do |word|
      answer = get_word_from_grid(word, grid)
      clue = Clue.where("answer = ?", answer).order("RANDOM()").first
      next unless clue
      puzzle.puzzle_clues.create!(clue: clue, number: word[:number], direction: word[:direction])
    end

    puzzle
  end

  def get_valid_words(word_list, pattern, used_words = Set.new)
    debugger if pattern.nil?
    regex = Regexp.new("^#{pattern.gsub('_', '.')}$")
    debugger if word_list.nil?
    word_list.select { |word| word.match(regex) && !used_words.include?(word) }.shuffle
  end

  def get_intersecting_patterns(intersecting, word, grid)
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

  def get_best_word_and_score(word, word_info, grid, used_words = Set.new, logger = nil)
    logger.update_message("Analyzing word: #{word[:number]} #{word[:direction]}") if logger
    intersecting = intersecting_words(word_info, word)
    main_word_pattern = get_word_from_grid(word, grid)


    intersecting_patterns = get_intersecting_patterns(intersecting, word, grid)


    best_score = 0
    best_word = nil

    # Ensure word[:word_list] is initialized
    word_list = get_valid_words(word[:word_list], main_word_pattern, used_words)

    # Debug: print candidate list before scoring
    # p "Candidates for #{word[:number]} #{word[:direction]}: #{word_list.inspect}"

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

    # Debug: print selected word and candidate list
    # p "Selected for #{word[:number]} #{word[:direction]}: #{best_word.inspect} from candidates: #{word_list.join(', ')}"

    { word: best_word, score: best_score }
  end

  # def get_best_word_and_score_sql(word, word_info, grid, used_words = Set.new)
  #   # Simple in-memory cache for SQL queries
  #   @sql_cache ||= {}
  #   # Find all intersecting words in the word_info
  #   intersecting = intersecting_words(word_info, word)

  #   main_word_pattern = get_word_from_grid(word, grid)

  #   intersecting_patterns = intersecting.map do |iw|
  #     pattern = get_word_from_grid(iw, grid)
  #     overlap = iw[:cells] & word[:cells]
  #     idx = nil
  #     main_word_intersection_index = nil
  #     overlap.each do |row, col|
  #       idx = iw[:cells].index([ row, col ])
  #       main_word_idx = word[:cells].index([ row, col ])
  #       if main_word_idx
  #         main_word_intersection_index = main_word_idx + 1 # 1-based index for SQL
  #       end
  #       pattern[idx] = "$" if idx
  #     end
  #     { pattern: pattern, length: iw[:length], main_word_intersection_index: main_word_intersection_index }
  #   end

  #   intersection_count = intersecting_patterns.count

  #   used_words_clause = used_words.any? ? "AND answer NOT IN ('#{used_words.to_a.join("','")}')" : ""

  #   if intersection_count == 0
  #     word_length = word[:length]
  #     sql = "SELECT distinct answer FROM clues
  #     WHERE LENGTH(answer) = #{word_length}
  #     AND answer LIKE '#{main_word_pattern}'
  #     #{used_words_clause}
  #     LIMIT 1"
  #   else

  #     lengths = intersecting_patterns.map { |p| p[:length] }
  #     lengths << word[:length]
  #     lengths.uniq!

  #     sql = "WITH "
  #     sql << lengths.map do |len|
  #       "letter_word#{len} AS (
  #       SELECT answer
  #       FROM clues
  #       WHERE LENGTH(answer) = #{len}
  #       #{used_words_clause})"
  #     end.join(", ")

  #     sql << ",
  #     word1 AS (
  #     SELECT answer
  #     FROM letter_word#{word[:length]}
  #     where answer LIKE '#{main_word_pattern}')"

  #     intersecting_patterns.each_with_index do |pat, index|
  #       match_pattern = pat[:pattern]
  #       index_s = (index + 2).to_s
  #       length_s = pat[:length].to_s
  #       main_word_intersection_index = pat[:main_word_intersection_index].to_s

  #       sql << ",
  #       word#{index_s} AS (
  #       SELECT word1.answer, count(f.answer) count#{index_s}
  #       FROM word1
  #       LEFT JOIN letter_word#{length_s} f ON f.answer LIKE #{sql_pattern_with_grid(match_pattern, main_word_intersection_index)}
  #       GROUP BY word1.answer)"
  #     end

  #     sql << "
  #     SELECT word1.answer, min(" + (0...intersection_count).map { |count| "count#{(count + 2)}" }.join(", ") + ") as min_count
  #     FROM word1
  #     " << (0...intersection_count).map { |count| "LEFT JOIN word#{(count + 2)} ON word1.answer = word#{(count + 2)}.answer" }.join(" ")
  #     sql << "
  #     GROUP BY word1.answer
  #     ORDER BY min_count DESC
  #     LIMIT 1
  #     "
  #   end

  #   cache_key = Digest::SHA256.hexdigest(sql)
  #   if @sql_cache.key?(cache_key)
  #     Rails.logger.info "Using cached result"
  #     best = @sql_cache[cache_key]
  #   else
  #     result = ActiveRecord::Base.connection.execute(sql)
  #     best = result.first
  #     @sql_cache[cache_key] = best
  #   end

  #   debugger if best.nil? || best["answer"].nil? || best["min_count"].nil?

  #   { word: best["answer"], score: best["min_count"] }
  # end

  # sql = <<-SQL
  #     WITH five_letter_words AS (
  #     SELECT answer FROM clues WHERE length(answer) = 5
  #     ),
  #     word1 AS (
  #     SELECT f.answer FROM five_letter_words f
  #     ),
  #     word2 AS (
  #     SELECT word1.answer, count(f.answer) count2 FROM five_letter_words f
  #     LEFT JOIN word1 ON f.answer LIKE SUBSTR(word1.answer, 1, 1) || '____'
  #     group by word1.answer
  #     ),
  #     word3 AS (
  #     SELECT word1.answer, count(f.answer) count3 FROM five_letter_words f
  #     LEFT JOIN word1 ON f.answer LIKE SUBSTR(word1.answer, 2, 1) || '____'
  #     group by word1.answer
  #     ),
  #     word4 AS (
  #     SELECT word1.answer, count(f.answer) count4
  #     FROM five_letter_words f
  #     LEFT JOIN word1 ON f.answer LIKE SUBSTR(word1.answer, 3, 1) || '____'
  #     group by word1.answer
  #     ),
  #     word5 AS (
  #     SELECT f.answer, count(f2.answer) count5 FROM five_letter_words f
  #     LEFT JOIN word4 f2 ON f.answer LIKE SUBSTR(f2.answer, 4 , 1) || '____'
  #     group by f.answer
  #     ),
  #     word6 AS (
  #     SELECT word1.answer, count(f.answer) count6 FROM five_letter_words f
  #     LEFT JOIN word1 ON f.answer LIKE SUBSTR(word1.answer, 5, 1) || '____'
  #     group by word1.answer
  #     )
  #     SELECT word1.answer, min(count2, count3, count4, count5, count6) as min_count
  #     FROM word1
  #     LEFT JOIN word2 ON word1.answer = word2.answer
  #     LEFT JOIN word3 ON word1.answer = word3.answer
  #     LEFT JOIN word4 ON word1.answer = word4.answer
  #     LEFT JOIN word5 ON word1.answer = word5.answer
  #     LEFT JOIN word6 ON word1.answer = word6.answer
  #     group by word1.answer
  #     ORDER BY min_count DESC
  #     LIMIT 1

  #   SQL

  #       ActiveRecord::Base.connection.execute(sql)



  # "WITH letter_word5 AS (
  #   SELECT answer
  #   FROM   clues
  #   WHERE  LENGTH(answer) = 5),
  # word1 AS (
  # SELECT  answer
  # FROM    letter_word5),
  #   word5 AS (
  #   SELECT word1.answer, count(distinct f.answer) count2
  #   FROM       word1
  #   LEFT JOIN  letter_word5 f on
  #   WHERE  answer LIKE REPLACE('$____'), '$', SUBSTR(word1.answer, 1, 1) GROUP BY word1.answer),
  #   word5 AS (
  #   SELECT word1.answer, count(distinct f.answer) count3
  #   FROM       word1
  #   LEFT JOIN  letter_word5 f on
  #   WHERE  answer LIKE REPLACE('$____'), '$', SUBSTR(word1.answer, 5, 1) GROUP BY word1.answer)"
  #      SELECT word1.answer, min(count2, count3, count4, count5, count6) as min_count
  #       FROM word1
  #       LEFT JOIN word2 ON word1.answer = word2.answer
  #       LEFT JOIN word3 ON word1.answer = word3.answer
  #       LEFT JOIN word4 ON word1.answer = word4.answer
  #       LEFT JOIN word5 ON word1.answer = word5.answer
  #       LEFT JOIN word6 ON word1.answer = word6.answer
  #       group by word1.answer
  #       ORDER BY min_count DESC
  #       LIMIT 1



  # sql = <<-SQL
  #     WITH words_with_length AS (
  #     SELECT answer, length(answer) len FROM clues
  #     ),
  #     word1 AS (
  #     SELECT f.answer FROM words_with_length f
  #     where len = 5
  #     ),
  #     word2 AS (
  #     SELECT word1.answer, count(f.answer) count2 FROM five_letter_words f
  #     LEFT JOIN word1 ON f.answer LIKE SUBSTR(word1.answer, 1, 1) || '____'
  #     group by word1.answer
  #     ),
  #     word3 AS (
  #     SELECT word1.answer, count(f.answer) count3 FROM five_letter_words f
  #     LEFT JOIN word1 ON f.answer LIKE SUBSTR(word1.answer, 2, 1) || '____'
  #     group by word1.answer
  #     ),
  #     word4 AS (
  #     SELECT word1.answer, count(f.answer) count4 FROM five_letter_words f
  #     LEFT JOIN word1 ON f.answer LIKE SUBSTR(word1.answer, 3, 1) || '____'
  #     group by word1.answer
  #     ),
  #     word5 AS (
  #     SELECT f.answer, count(f2.answer) count5 FROM five_letter_words f
  #     LEFT JOIN word4 f2 ON f.answer LIKE SUBSTR(f2.answer, 4 , 1) || '____'
  #     group by f.answer
  #     ),
  #     word6 AS (
  #     SELECT word1.answer, count(f.answer) count6 FROM five_letter_words f
  #     LEFT JOIN word1 ON f.answer LIKE SUBSTR(word1.answer, 5, 1) || '____'
  #     group by word1.answer
  #     )
  #     SELECT word1.answer, min(count2, count3, count4, count5, count6) as min_count
  #     FROM word1
  #     LEFT JOIN word2 ON word1.answer = word2.answer
  #     LEFT JOIN word3 ON word1.answer = word3.answer
  #     LEFT JOIN word4 ON word1.answer = word4.answer
  #     LEFT JOIN word5 ON word1.answer = word5.answer
  #     LEFT JOIN word6 ON word1.answer = word6.answer
  #     group by word1.answer
  #     ORDER BY min_count DESC
  #     LIMIT 1

  #   SQL

  #       ActiveRecord::Base.connection.execute(sql)
  def sql_pattern_with_grid(pattern, main_word_intersection_index, word1_alias = "word1")
    # pattern: e.g. "_$_$_"
    # Replace each $ with SUBSTR(word1.answer, position, 1)
    sql_pattern = pattern.dup
    pattern.chars do |char|
      if char == "$"
        # SQLite is 1-based indexing
        sql_pattern.sub!("$", "' || SUBSTR(#{word1_alias}.answer, #{main_word_intersection_index}, 1) || '")
      end
    end
    "'#{sql_pattern}'"
  end

  # Given a grid and numbering, return all word slots (blanks) in the puzzle
  def extract_word_info(grid, numbering)
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

  # Helper: does this cell start an across word?
  def starts_across_word?(grid, row, col, width)
    return false if grid[row][col] == "#"
    left_is_blocked = col == 0 || grid[row][col - 1] == "#"
    right_exists = col < width - 1 && grid[row][col + 1] != "#"
    left_is_blocked && right_exists
  end

  # Helper: does this cell start a down word?
  def starts_down_word?(grid, row, col, height)
    return false if grid[row][col] == "#"
    top_is_blocked = row == 0 || grid[row - 1][col] == "#"
    bottom_exists = row < height - 1 && grid[row + 1][col] != "#"
    top_is_blocked && bottom_exists
  end

  def save_puzzle_clue
    puzzle = Puzzle.find(params[:puzzle_id])
    clue = Clue.find(params[:clue_id])
    number = params[:number].to_i
    direction = params[:direction]

    # Check if this puzzle clue already exists
    existing_puzzle_clue = puzzle.puzzle_clues.find_by(number: number, direction: direction)

    if existing_puzzle_clue
      # Update existing
      existing_puzzle_clue.update(clue: clue)
      render json: { success: true, message: "Updated existing clue" }
    else
      # Create new
      puzzle_clue = puzzle.puzzle_clues.build(
        clue: clue,
        number: number,
        direction: direction
      )

      if puzzle_clue.save
        render json: { success: true, message: "Clue saved successfully" }
      else
        render json: { success: false, error: puzzle_clue.errors.full_messages.join(", ") }
      end
    end
  rescue ActiveRecord::RecordNotFound => e
    render json: { success: false, error: "Puzzle or clue not found" }
  rescue => e
    render json: { success: false, error: e.message }
  end

  private
    # Given a word_info hash and a grid, return the current word string from the grid
    def get_word_from_grid(word, grid)
      word[:cells].map { |row, col| grid[row][col] || "_" }.join
    end

    def load_puzzle
      @puzzle = Puzzle.find(params[:id]) if params[:id]
    end

    def valid_position?(row, col)
      max_height = @puzzle&.height || 15
      max_width = @puzzle&.width || 15
      row >= 0 && row < max_height && col >= 0 && col < max_width
    end

    def generate_empty_grid(width = 15, height = 15)
      Array.new(height) { Array.new(width) { nil } }
    end

    def puzzle_params
      params.require(:puzzle).permit(:title, :description, :difficulty)
    end

    # Given word_info array and a specific word hash, return all intersecting words
    def intersecting_words(word_info, target_word)
      target_cells = target_word[:cells].to_set
      word_info.select do |word|
        word != target_word && !(word[:cells].to_set & target_cells).empty?
      end
    end
end
