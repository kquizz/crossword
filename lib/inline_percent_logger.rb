# InlinePercentLogger provides progress tracking functionality for Rails migrations and scripts
#
# Usage examples:
#
# 1. Simple usage with module methods:
#    InlinePercentLogger.start("Processing records", total: 1000)
#    1000.times do |i|
#      # Do some work...
#      InlinePercentLogger.update(i + 1)
#    end
#    InlinePercentLogger.finish
#
# 2. Block-based usage:
#    InlinePercentLogger.track("Processing records", total: 1000) do |logger|
#      1000.times do |i|
#        # Do some work...
#        logger.update(i + 1)
#      end
#    end
#
# 3. Instance-based usage:
#    logger = InlinePercentLogger.new("Processing records", total: 1000)
#    1000.times do |i|
#      # Do some work...
#      logger.update(i + 1)
#    end
#    logger.finish
#
module InlinePercentLogger
  # Helper method to get current time (works in both Rails and pure Ruby)
  def self.current_time
    defined?(Time.current) ? Time.current : Time.zone.now
  end

  class ProgressTracker
    attr_reader :message, :total, :current, :start_time

    def initialize(message)
      @message = message
      @total = total
      @current = 0
      @start_time = InlinePercentLogger.current_time
      @last_lines = 0
    end

    def update(current_count)
      @current = [ current_count, @total ].min

      display_progress
    end

    def update_message(new_message)
      @message = new_message
      display_progress_without_progress_bar
    end

    def increment(step = 1)
      update(@current + step)
    end

    def finish(completion_message = "Done.")
      @current = @total
      display_progress
      Rails.logger.debug "\n#{ completion_message }"
    end

    private def validate_inputs!
      unless @total.is_a?(Integer) && @total.positive?
        raise ArgumentError,
          "Total must be a positive integer"
      end
      raise ArgumentError, "Message cannot be blank" if @message.nil? || @message.strip.empty?
    end

    private def display_initial_message
      Rails.logger.debug "#{ @message }"
    end

    private def display_progress
      percentage = (@current.to_f / @total * 100).round(1)
      progress_info = build_progress_info(percentage)

      output = "#{@message} #{progress_info}"

      # Always use terminal overwrite logic
      lines = output.count("\n") + 1
      print "\e[#{lines}A" if @last_lines && @last_lines > 0
      print "\e[0J" # Clear from cursor down
      puts output
      @last_lines = lines
      $stdout.flush
    end

    private def display_progress_without_progress_bar
      output = "#{@message}"
      lines = output.count("\n") + 1
      print "\e[#{lines}A" if @last_lines && @last_lines > 0
      print "\e[0J" # Clear from cursor down
      puts output
      @last_lines = lines
      $stdout.flush
    end

    private def build_progress_info(percentage)
      "(#{ @current }/#{ @total }) - #{ percentage }%"
    end
  end

  class << self
    attr_reader :current_tracker

    # Start tracking progress
    def start(message, total:, **options)
      @current_tracker = ProgressTracker.new(message, total: total, **options)
    end

    # Update current progress
    def update(current_count)
      unless @current_tracker
        raise "No active progress tracker. Call InlinePercentLogger.start first."
      end
      @current_tracker.update(current_count)
    end

    # Increment progress by step (default 1)
    def increment(step = 1)
      unless @current_tracker
        raise "No active progress tracker. Call InlinePercentLogger.start first."
      end
      @current_tracker.increment(step)
    end

    # Finish current progress tracking
    def finish(completion_message = "Done.")
      unless @current_tracker
        raise "No active progress tracker. Call InlinePercentLogger.start first."
      end
      @current_tracker.finish(completion_message)
      @current_tracker = nil
    end

    # Track progress within a block
    def track(message, total:, **options)
      tracker = ProgressTracker.new(message, total: total, **options)

      if block_given?
        begin
          yield tracker
          tracker.finish
        rescue StandardError => exception
          Rails.logger.debug "\nProgress tracking interrupted due to error: #{ exception.message }"
          raise
        end
      else
        tracker
      end
    end

    # Create a new tracker instance
    def new(message, **options)
      ProgressTracker.new(message, **options)
    end
  end
end
