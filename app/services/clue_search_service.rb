class ClueSearchService
  def self.search_with_constraints(length:, pattern:, intersecting_constraints: [])
    new(length, pattern, intersecting_constraints).search
  end

  def initialize(length, pattern, intersecting_constraints = [])
    @length = length
    @pattern = pattern.upcase
    @intersecting_constraints = intersecting_constraints
  end

  def search
    # Convert pattern to SQL LIKE pattern (replace _ with %)
    sql_pattern = @pattern.gsub("_", "%")

    # Get initial candidates
    clues = Clue.select(:id, :clue_text, :answer)
                .where("LENGTH(answer) = ? AND UPPER(answer) LIKE ?", @length, sql_pattern)
                .limit(50)

    # Apply intersecting constraints if present
    if @intersecting_constraints.present?
      filtered_clues = filter_by_constraints(clues.limit(100)) # Get more candidates for filtering
      # Take first 20 after filtering
      filtered_clues.first(20).map do |clue|
        build_clue_response(clue)
      end
    else
      # No constraints - use database limit
      clues.limit(20).map do |clue|
        build_clue_response(clue)
      end
    end
  end

  private

    def filter_by_constraints(clues)
      log_constraints

      clues.select do |clue|
        answer = clue.answer.upcase
        validate_answer_against_constraints(answer)
      end
    end

    def validate_answer_against_constraints(answer)
      Rails.logger.info "\n🧪 TESTING: #{answer}"

      @intersecting_constraints.each_with_index do |constraint, i|
        position = constraint["position"]
        intersecting_pattern = constraint["intersecting_pattern"].upcase
        intersecting_position = constraint["intersecting_position"]

        candidate_letter = answer[position]
        existing_letter = intersecting_pattern[intersecting_position]

        Rails.logger.info "  #{i + 1}. #{answer}[#{position}] = '#{candidate_letter}' vs #{constraint['intersecting_direction']} pattern '#{intersecting_pattern}'[#{intersecting_position}] = '#{existing_letter}'"

        # Check for conflicts
        if existing_letter != "_" && existing_letter != candidate_letter
          Rails.logger.info "     ✗ CONFLICT: '#{candidate_letter}' ≠ '#{existing_letter}'"
          return false
        end

        Rails.logger.info "     ✓ OK: '#{candidate_letter}' matches '#{existing_letter}' (or slot is empty)"

        # Validate completed words
        unless validate_completed_word(intersecting_pattern, intersecting_position, candidate_letter, answer)
          return false
        end
      end

      Rails.logger.info "  → ✅ ACCEPTED: #{answer}"
      true
    end

    def validate_completed_word(intersecting_pattern, intersecting_position, candidate_letter, answer)
      return true if intersecting_pattern[intersecting_position] != "_"

      # Create hypothetical completed word
      completed_pattern = intersecting_pattern.dup
      completed_pattern[intersecting_position] = candidate_letter

      # Check if word is complete
      return true if completed_pattern.include?("_")

      Rails.logger.info "     🔍 Checking if completed word '#{completed_pattern}' exists in clue database..."

      # Validate completed word exists
      if Clue.where("UPPER(answer) = ?", completed_pattern).exists?
        Rails.logger.info "     ✅ VALID: Found clue for '#{completed_pattern}'"
        true
      else
        Rails.logger.info "     ❌ INVALID: No clue found for '#{completed_pattern}' - rejecting #{answer}"
        false
      end
    end

    def build_clue_response(clue)
      clue_data = {
        id: clue.id,
        clue_text: clue.clue_text,
        answer: clue.answer,
        completed_intersections: []
      }

      if @intersecting_constraints.present?
        clue_data[:completed_intersections] = find_completed_intersections(clue)
      end

      clue_data
    end

    def find_completed_intersections(clue)
      completed = []

      @intersecting_constraints.each do |constraint|
        position = constraint["position"]
        intersecting_pattern = constraint["intersecting_pattern"].upcase
        intersecting_position = constraint["intersecting_position"]
        candidate_letter = clue.answer.upcase[position]

        # Skip if not filling a blank
        next unless intersecting_pattern[intersecting_position] == "_"

        completed_pattern = intersecting_pattern.dup
        completed_pattern[intersecting_position] = candidate_letter

        # Skip if word not complete
        next if completed_pattern.include?("_")

        # Find matching clue
        matching_clue = Clue.where("UPPER(answer) = ?", completed_pattern).first
        if matching_clue
          completed << {
            direction: constraint["intersecting_direction"],
            number: constraint["intersecting_number"],
            clue_id: matching_clue.id,
            clue_text: matching_clue.clue_text,
            answer: matching_clue.answer
          }
        end
      end

      completed
    end

    def log_constraints
      Rails.logger.info "🔍 CONSTRAINT CHECKING - Found #{@intersecting_constraints.length} constraints:"
      @intersecting_constraints.each_with_index do |constraint, i|
        Rails.logger.info "  #{i + 1}. Position #{constraint['position']} → #{constraint['intersecting_direction']} word '#{constraint['intersecting_pattern']}' at position #{constraint['intersecting_position']}"
      end
    end
end
