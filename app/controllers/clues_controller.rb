class CluesController < ApplicationController
  before_action :set_clue, only: %i[ show edit update destroy ]
  skip_before_action :verify_authenticity_token, only: [ :search ]

  # GET /clues or /clues.json
  def index
    @clues = Clue.all
  end

  # POST /clues/search - Search for clues matching a pattern
  def search
    length = params[:length].to_i
    pattern = params[:pattern].upcase
    intersecting_constraints = params[:intersecting_constraints] || []

    # Convert pattern to SQL LIKE pattern (replace _ with %)
    sql_pattern = pattern.gsub("_", "%")

    clues = Clue.select(:id, :clue_text, :answer)
                .where("LENGTH(answer) = ? AND UPPER(answer) LIKE ?", length, sql_pattern)
                .limit(50) # Get more candidates to filter

    # Filter out clues that would conflict with intersecting word constraints
    if intersecting_constraints.present?
      Rails.logger.info "🔍 CONSTRAINT CHECKING - Found #{intersecting_constraints.length} constraints:"
      intersecting_constraints.each_with_index do |constraint, i|
        Rails.logger.info "  #{i + 1}. Position #{constraint['position']} → #{constraint['intersecting_direction']} word '#{constraint['intersecting_pattern']}' at position #{constraint['intersecting_position']}"
      end

      filtered_clues = clues.select do |clue|
        answer = clue.answer.upcase
        valid_answer = true
        Rails.logger.info "\n🧪 TESTING: #{answer}"

        intersecting_constraints.each_with_index do |constraint, i|
          position = constraint["position"]
          intersecting_pattern = constraint["intersecting_pattern"].upcase
          intersecting_position = constraint["intersecting_position"]

          # Get the letter that would be placed at this intersection
          candidate_letter = answer[position]
          existing_letter = intersecting_pattern[intersecting_position]

          Rails.logger.info "  #{i + 1}. #{answer}[#{position}] = '#{candidate_letter}' vs #{constraint['intersecting_direction']} pattern '#{intersecting_pattern}'[#{intersecting_position}] = '#{existing_letter}'"

          # Check if this letter would fit in the intersecting word pattern
          if existing_letter != "_" && existing_letter != candidate_letter
            Rails.logger.info "     ✗ CONFLICT: '#{candidate_letter}' ≠ '#{existing_letter}'"
            valid_answer = false
            break
          else
            Rails.logger.info "     ✓ OK: '#{candidate_letter}' matches '#{existing_letter}' (or slot is empty)"

            # If we're filling a blank, check if the resulting word would be valid
            if existing_letter == "_"
              # Create the hypothetical completed word
              completed_pattern = intersecting_pattern.dup
              completed_pattern[intersecting_position] = candidate_letter

              # Check if this word would be complete (no more blanks)
              if !completed_pattern.include?("_")
                Rails.logger.info "     🔍 Checking if completed word '#{completed_pattern}' exists in clue database..."

                # Check if this completed word exists as an answer in our clue database
                matching_clue = Clue.where("UPPER(answer) = ?", completed_pattern).first

                if matching_clue
                  Rails.logger.info "     ✅ VALID: Found clue for '#{completed_pattern}': #{matching_clue.clue_text}"
                else
                  Rails.logger.info "     ❌ INVALID: No clue found for '#{completed_pattern}' - rejecting #{answer}"
                  valid_answer = false
                  break
                end
              else
                Rails.logger.info "     ⏳ Word '#{completed_pattern}' still has blanks - validation deferred"
              end
            end
          end
        end

        if valid_answer
          Rails.logger.info "  → ✅ ACCEPTED: #{answer}"
        else
          Rails.logger.info "  → ❌ REJECTED: #{answer}"
        end
        valid_answer
      end

      Rails.logger.info "\n📊 SUMMARY: #{filtered_clues.length} of #{clues.length} clues passed constraints"
      clues = filtered_clues.first(20)
    else
      clues = clues.limit(20)
    end

    # For each valid clue, also calculate what intersecting words would be completed
    clues_with_completions = clues.map do |clue|
      clue_data = {
        id: clue.id,
        clue_text: clue.clue_text,
        answer: clue.answer,
        completed_intersections: []
      }

      if intersecting_constraints.present?
        intersecting_constraints.each do |constraint|
          position = constraint["position"]
          intersecting_pattern = constraint["intersecting_pattern"].upcase
          intersecting_position = constraint["intersecting_position"]
          candidate_letter = clue.answer.upcase[position]

          # If this would fill a blank
          if intersecting_pattern[intersecting_position] == "_"
            completed_pattern = intersecting_pattern.dup
            completed_pattern[intersecting_position] = candidate_letter

            # If this completes the word
            if !completed_pattern.include?("_")
              matching_clue = Clue.where("UPPER(answer) = ?", completed_pattern).first
              if matching_clue
                clue_data[:completed_intersections] << {
                  direction: constraint["intersecting_direction"],
                  number: constraint["intersecting_number"],
                  clue_id: matching_clue.id,
                  clue_text: matching_clue.clue_text,
                  answer: matching_clue.answer
                }
              end
            end
          end
        end
      end

      clue_data
    end

    render json: clues_with_completions
  end  # GET /clues/1 or /clues/1.json
  def show
  end

  # GET /clues/new
  def new
    @clue = Clue.new
  end

  # GET /clues/1/edit
  def edit
  end

  # POST /clues or /clues.json
  def create
    @clue = Clue.new(clue_params)

    respond_to do |format|
      if @clue.save
        format.html { redirect_to @clue, notice: "Clue was successfully created." }
        format.json { render :show, status: :created, location: @clue }
      else
        format.html { render :new, status: :unprocessable_entity }
        format.json { render json: @clue.errors, status: :unprocessable_entity }
      end
    end
  end

  # PATCH/PUT /clues/1 or /clues/1.json
  def update
    respond_to do |format|
      if @clue.update(clue_params)
        format.html { redirect_to @clue, notice: "Clue was successfully updated." }
        format.json { render :show, status: :ok, location: @clue }
      else
        format.html { render :edit, status: :unprocessable_entity }
        format.json { render json: @clue.errors, status: :unprocessable_entity }
      end
    end
  end

  # DELETE /clues/1 or /clues/1.json
  def destroy
    @clue.destroy!

    respond_to do |format|
      format.html { redirect_to clues_path, status: :see_other, notice: "Clue was successfully destroyed." }
      format.json { head :no_content }
    end
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_clue
      @clue = Clue.find(params.expect(:id))
    end

    # Only allow a list of trusted parameters through.
    def clue_params
      params.expect(clue: [ :clue_text, :answer, :difficulty, :category ])
    end
end
